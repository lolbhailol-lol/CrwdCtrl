/**
 * Reconcile PaymentOrders stuck PENDING while Cashfree already reports PAID.
 * Covers webhook miss + client never returning from PG (Instagram / slow network).
 */
const PaymentOrder = require('../model/payment_order_model');
const { verifyCashfreePayment } = require('./cashfreeService');
const { logger } = require('../utils/logger');

const RECONCILE_ENTITY_TYPES = ['sports', 'fest', 'competition', 'event_show', 'trek'];

function envMs(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function fulfillPaidOrder(updated) {
  if (!updated) return { fulfilled: false, reason: 'missing_order' };

  if (updated.entityType === 'event_show' && updated.orderTags?.registrationDraft) {
    const { fulfillEventShowFromPaidOrder } = require('./eventShowPaymentFulfillment');
    await fulfillEventShowFromPaidOrder(updated);
    return { fulfilled: true, entityType: 'event_show' };
  }

  if (['fest', 'competition'].includes(updated.entityType) && updated.orderTags?.registrationDraft) {
    const { fulfillFestCompetitionFromPaidOrder } = require('./festCompetitionPaymentFulfillment');
    await fulfillFestCompetitionFromPaidOrder(updated);
    return { fulfilled: true, entityType: updated.entityType };
  }

  if (updated.entityType === 'sports' && updated.orderTags?.formData) {
    const { fulfillSportsFromPaidOrder } = require('./sportsPaymentFulfillment');
    await fulfillSportsFromPaidOrder(updated);
    return { fulfilled: true, entityType: 'sports' };
  }

  if (updated.entityType === 'trek' && updated.orderTags?.formData) {
    const { fulfillTrekFromPaidOrder } = require('./trekPaymentFulfillment');
    await fulfillTrekFromPaidOrder(updated);
    return { fulfilled: true, entityType: 'trek' };
  }

  return { fulfilled: false, reason: 'no_draft' };
}

/**
 * Scan recent PENDING Cashfree orders and fulfill any that Cashfree marks PAID.
 * @returns {{ checked: number, paid: number, fulfilled: number, errors: number }}
 */
async function reconcilePendingCashfreeOrders({
  limit = Number(process.env.PENDING_PAYMENT_RECONCILE_LIMIT) || 25,
  minAgeMs = envMs('PENDING_PAYMENT_RECONCILE_MIN_AGE_MS', 2 * 60 * 1000),
  maxAgeMs = envMs('PENDING_PAYMENT_RECONCILE_MAX_AGE_MS', 45 * 60 * 1000),
} = {}) {
  const now = Date.now();
  const newerThan = new Date(now - maxAgeMs);
  const olderThan = new Date(now - minAgeMs);

  const pending = await PaymentOrder.find({
    status: 'PENDING',
    entityType: { $in: RECONCILE_ENTITY_TYPES },
    createdAt: { $gte: newerThan, $lte: olderThan },
    $or: [{ gateway: 'cashfree' }, { gateway: { $exists: false } }, { gateway: null }],
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(limit, 50)))
    .select('orderId entityType cashfreeMerchant status orderTags paymentId')
    .lean();

  const summary = { checked: pending.length, paid: 0, fulfilled: 0, errors: 0 };

  for (const row of pending) {
    const orderId = row.orderId;
    if (!orderId) continue;
    try {
      const merchant = row.cashfreeMerchant === 'events' ? 'events' : 'platform';
      const result = await verifyCashfreePayment({ orderId, merchant });
      if (!result.verified || result.status !== 'paid') continue;

      summary.paid += 1;

      const updated = await PaymentOrder.findOneAndUpdate(
        { orderId, status: 'PENDING' },
        {
          status: 'PAID',
          ...(result.paymentId ? { paymentId: String(result.paymentId) } : {}),
        },
        { upsert: false, new: true },
      );

      if (!updated) {
        // Already flipped by webhook/verify — still try fulfill for sports/fest drafts.
        const existing = await PaymentOrder.findOne({ orderId });
        if (existing && String(existing.status).toUpperCase() === 'PAID') {
          const out = await fulfillPaidOrder(existing);
          if (out.fulfilled) summary.fulfilled += 1;
        }
        continue;
      }

      const out = await fulfillPaidOrder(updated);
      if (out.fulfilled) summary.fulfilled += 1;
      logger.info('[pendingReconcile] recovered PAID order', {
        orderId,
        entityType: updated.entityType,
        fulfilled: out.fulfilled,
        reason: out.reason || null,
      });
    } catch (err) {
      summary.errors += 1;
      logger.warn('[pendingReconcile] order failed', {
        orderId,
        error: err?.message || String(err),
      });
    }
  }

  if (summary.checked > 0) {
    logger.info('[pendingReconcile] tick', summary);
  }
  return summary;
}

function initPendingPaymentReconcileCron() {
  if (process.env.NODE_ENV === 'test') return;
  if (String(process.env.PENDING_PAYMENT_RECONCILE_DISABLED || '').toLowerCase() === 'true') {
    logger.info('Pending payment reconcile cron disabled via env');
    return;
  }

  const intervalMs = envMs('PENDING_PAYMENT_RECONCILE_MS', 3 * 60 * 1000);
  logger.info('Pending payment reconcile cron started', { intervalMs });

  const tick = () => {
    reconcilePendingCashfreeOrders().catch((err) => {
      logger.warn('[pendingReconcile] tick failed', { error: err.message });
    });
  };

  setTimeout(tick, 40000);
  setInterval(tick, intervalMs);
}

module.exports = {
  RECONCILE_ENTITY_TYPES,
  reconcilePendingCashfreeOrders,
  fulfillPaidOrder,
  initPendingPaymentReconcileCron,
};
