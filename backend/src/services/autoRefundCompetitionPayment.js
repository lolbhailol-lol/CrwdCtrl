'use strict';

const crypto = require('crypto');
const PaymentRefund = require('../model/payment_refund_model');
const PaymentOrder = require('../model/payment_order_model');
const { createCashfreeRefund } = require('./cashfreeService');
const { normalizeRefundPayload, upsertRefund } = require('./cashfreeSettlementSync');
const { logger } = require('../utils/logger');

/**
 * Queue a Cashfree refund for a PAID competition order that must not keep a ticket
 * (duplicate pay, capacity paid_review, retired desk order).
 */
async function queueAutomaticCompetitionRefund(paymentOrderInput, {
  reason = 'duplicate_or_capacity',
  actor = 'system:auto_refund',
} = {}) {
  const orderId = typeof paymentOrderInput === 'string'
    ? paymentOrderInput
    : paymentOrderInput?.orderId;
  if (!orderId) return { ok: false, error: 'missing_order' };

  const paymentOrder = typeof paymentOrderInput === 'object' && paymentOrderInput.orderId
    ? paymentOrderInput
    : await PaymentOrder.findOne({ orderId: String(orderId) });
  if (!paymentOrder) return { ok: false, error: 'order_not_found' };
  if (String(paymentOrder.status || '').toUpperCase() !== 'PAID') {
    return { ok: false, error: 'not_paid' };
  }

  const existing = await PaymentRefund.findOne({
    orderId,
    status: { $in: ['SUCCESS', 'PENDING', 'INITIATED'] },
  }).lean();
  if (existing) {
    return { ok: true, already: true, refundId: existing.refundId || existing.cfRefundId };
  }

  paymentOrder.orderTags = {
    ...(paymentOrder.orderTags || {}),
    paidReview: true,
    autoRefundReason: String(reason || '').slice(0, 120),
    autoRefundQueuedAt: new Date().toISOString(),
  };
  paymentOrder.markModified('orderTags');
  await paymentOrder.save().catch(() => {});

  try {
    const digest = crypto.createHash('sha256')
      .update(`auto-refund:${orderId}:${reason}`)
      .digest('hex');
    const refundId = `auto_${digest.slice(0, 24)}`;
    const idempotencyKey = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const raw = await createCashfreeRefund({
      orderId,
      amount: Number(paymentOrder.totalAmount),
      refundId,
      idempotencyKey,
      note: String(reason || 'Auto refund').slice(0, 100),
      merchant: paymentOrder.cashfreeMerchant === 'events' ? 'events' : 'platform',
    });
    const payload = Array.isArray(raw) ? raw[0] : raw;
    const normalized = normalizeRefundPayload(payload, { orderId });
    await upsertRefund({
      normalized,
      source: 'api',
      raw: payload,
      actor,
    });
    logger.error('Queued automatic competition refund', {
      orderId,
      reason,
      refundId,
    });
    return { ok: true, refundId, status: normalized?.status || 'PENDING' };
  } catch (error) {
    logger.error('Automatic competition refund failed — needs ops review', {
      orderId,
      reason,
      message: error.message,
      data: error.response?.data,
    });
    return { ok: false, error: error.message || 'refund_failed', paidReview: true };
  }
}

module.exports = {
  queueAutomaticCompetitionRefund,
};
