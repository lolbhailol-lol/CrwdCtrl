const Registration = require('../model/registration_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const User = require('../model/usermodel');
const { createNotification } = require('../controllers/notificationController');
const { sendPushNotification } = require('./pushService');

/**
 * Initialize the event reminder cron job.
 * Runs every hour — checks for fests/competitions happening in the next 24h
 * and sends reminder notifications to registered users who haven't been reminded yet.
 */
const initReminderCron = () => {
  // Run every hour
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  const runReminders = async () => {
    try {
      console.log('⏰ Running event reminder check...');

      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find upcoming fests that are happening within the next 24 hours
      // festDate is stored as a string, so we need to handle different formats
      const upcomingFests = await FestOrganizer.find({
        status: { $in: ['upcoming', 'ongoing'] },
      }).lean();

      // Filter fests with dates in the next 24 hours
      const festsToRemind = [];
      for (const fest of upcomingFests) {
        try {
          if (!fest.festDate) continue;
          
          // Try to parse the date string
          const festDate = new Date(fest.festDate);
          if (isNaN(festDate.getTime())) continue;

          // Check if fest is within next 24 hours
          if (festDate > now && festDate <= twentyFourHoursFromNow) {
            festsToRemind.push(fest);
          }
        } catch (_) {
          // Skip fests with unparseable dates
        }
      }

      if (festsToRemind.length === 0) {
        console.log('⏰ No events to remind about right now');
        return;
      }

      console.log(`⏰ Found ${festsToRemind.length} fests happening in next 24h`);

      // Process each fest
      for (const fest of festsToRemind) {
        try {
          // Find registrations that haven't been reminded yet
          const registrations = await Registration.find({
            fest: fest._id,
            reminderSent: { $ne: true },
          }).lean();

          if (registrations.length === 0) continue;

          console.log(`⏰ Sending reminders for "${fest.festName}" to ${registrations.length} users`);

          // Send notifications to each registered user
          for (const reg of registrations) {
            try {
              // Create in-app notification
              await createNotification({
                userId: reg.user,
                title: '🕐 Event Tomorrow!',
                message: `"${fest.festName}" is happening tomorrow${fest.venue ? ' at ' + fest.venue : ''}. Don't forget to attend!`,
                type: 'reminder',
                link: `/view-details/${fest._id}`,
                metadata: {
                  festId: fest._id,
                  registrationId: reg._id,
                },
              });

              // Send push notification (non-blocking)
              sendPushNotification(reg.user.toString(), {
                title: '🕐 Event Tomorrow!',
                body: `"${fest.festName}" is happening tomorrow. Don't miss it!`,
                link: `/view-details/${fest._id}`,
                type: 'reminder',
              }).catch(err => {
                console.error('⚠️ Push reminder failed:', err.message);
              });

              // Mark reminder as sent
              await Registration.updateOne(
                { _id: reg._id },
                { reminderSent: true }
              );
            } catch (userErr) {
              console.error(`⚠️ Failed to send reminder to user ${reg.user}:`, userErr.message);
            }
          }

          console.log(`✅ Reminders sent for "${fest.festName}"`);
        } catch (festErr) {
          console.error(`❌ Error processing reminders for fest ${fest._id}:`, festErr.message);
        }
      }

      console.log('⏰ Reminder check completed');
    } catch (error) {
      console.error('❌ Reminder cron error:', error);
    }
  };

  // Run immediately on startup (after a short delay for DB connection)
  setTimeout(runReminders, 30000); // 30s delay after startup

  // Then run every hour
  setInterval(runReminders, INTERVAL_MS);

  console.log('⏰ Event reminder service initialized (runs every hour)');
};

module.exports = { initReminderCron };
