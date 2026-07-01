const { logger } = require('../utils/logger');

/**
 * Fest event reminder cron (disabled).
 * Previously sent 24h "Event Tomorrow" in-app + push notifications to fest registrants.
 * Trek organizer manual reminders are unaffected (trekOrganizerController.sendReminder).
 */
const initReminderCron = () => {
  logger.info('Fest event reminder cron is disabled');
};

module.exports = { initReminderCron };
