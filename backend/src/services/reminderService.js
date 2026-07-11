const { logger } = require('../utils/logger');

/**
 * Fest event reminder cron (disabled).
 * Previously sent 24h "Event Tomorrow" in-app + push notifications to fest registrants.
 * Trek organizer manual reminders are unaffected (trekOrganizerController.sendReminder).
 */
const initReminderCron = () => {
  logger.info('Fest event reminder cron is disabled');
};

/**
 * Expire stale organizer-QR pending payments globally every 15 minutes.
 * Complements lazy expiry on register/dashboard so seats free without page traffic.
 */
const initPendingPaymentExpiryCron = () => {
  const INTERVAL_MS = Math.max(
    5 * 60 * 1000,
    Number(process.env.RUN_QR_PENDING_CRON_MS) || 15 * 60 * 1000,
  );

  const tick = async () => {
    try {
      const { expireStalePendingRegistrations } = require('../utils/runClubRegistrationGuards');
      const count = await expireStalePendingRegistrations(null);
      if (count > 0) {
        logger.info('Expired stale QR pending payments', { count });
      }
    } catch (err) {
      logger.warn('Pending payment expiry cron failed', { error: err.message });
    }
  };

  // Delay first run slightly after boot
  setTimeout(() => {
    tick();
    setInterval(tick, INTERVAL_MS);
  }, 30_000);

  logger.info('Run-club pending payment expiry cron started', {
    intervalMinutes: Math.round(INTERVAL_MS / 60000),
  });
};

module.exports = { initReminderCron, initPendingPaymentExpiryCron };
