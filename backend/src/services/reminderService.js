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
 * Auto-expiry of organizer-QR pending payments is permanently disabled.
 * Organizers approve anytime; optional manual expire remains on the dashboard.
 *
 * This hook now starts Cashfree PENDING→PAID reconcile (not expiry), so
 * webhook/return misses still create registrations.
 */
const initPendingPaymentExpiryCron = () => {
  logger.info('Run-club pending payment auto-expiry is disabled');
  try {
    const { initPendingPaymentReconcileCron } = require('./pendingPaymentReconcileService');
    initPendingPaymentReconcileCron();
  } catch (err) {
    logger.warn('Pending payment reconcile cron failed to start', { error: err.message });
  }
};

module.exports = { initReminderCron, initPendingPaymentExpiryCron };
