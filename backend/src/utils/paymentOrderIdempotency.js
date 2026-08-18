const PaymentOrder = require('../model/payment_order_model');

const PENDING_ORDER_WINDOW_MS = 10 * 60 * 1000;

/** Mapped Cashfree statuses that can still complete on the same session. */
function shouldReuseMappedStatus(mapped) {
  return mapped === 'pending' || mapped === 'paid';
}

async function expireCancelledPaymentOrder(orderId) {
  if (!orderId) return;
  await PaymentOrder.updateOne(
    { orderId: String(orderId), status: 'PENDING' },
    { $set: { status: 'EXPIRED' } },
  );
}

function extractEntityId(notes = {}) {
  const raw =
    notes.eventShowId ||
    notes.trekId ||
    notes.eventId ||
    notes.competitionId ||
    notes.festId ||
    null;
  return raw || null;
}

/**
 * Reuse a recent pending Cashfree order for the same user/guest + entity + amount
 * to prevent duplicate charges on double-submit.
 */
async function findReusablePendingOrder({
  userId = null,
  customerEmail = null,
  entityType,
  entityId,
  totalAmount,
  people = null,
  couponCode = '',
}) {
  if (!entityType || !entityId || !totalAmount) return null;

  const since = new Date(Date.now() - PENDING_ORDER_WINDOW_MS);
  const filter = {
    entityType,
    entityId,
    status: 'PENDING',
    totalAmount: Number(totalAmount),
    couponCode: String(couponCode || '').trim().toUpperCase(),
    createdAt: { $gte: since },
  };

  if (people != null) filter.people = Number(people);

  if (userId) {
    filter.userId = userId;
  } else if (customerEmail) {
    filter.customerEmail = String(customerEmail).trim().toLowerCase();
  } else {
    return null;
  }

  // Must return a Mongoose document (not lean) — createOrder may call .save()
  // to refresh registrationDraft on reused pending sessions.
  const existing = await PaymentOrder.findOne(filter).sort({ createdAt: -1 });
  if (!existing) return null;

  try {
    const { fetchOrder, mapOrderStatus } = require('../services/cashfreeService');
    const cashfreeOrder = await fetchOrder(existing.orderId);
    const mapped = mapOrderStatus(cashfreeOrder?.order_status);
    if (!shouldReuseMappedStatus(mapped)) {
      existing.status = mapped === 'failed' ? 'FAILED' : 'EXPIRED';
      await existing.save().catch(() => {});
      return null;
    }
  } catch {
    // Cashfree unreachable: keep the pending session so a double-tap cannot open two charges.
  }

  return existing;
}

function buildOrderResponse(existing, extras = {}) {
  return {
    orderId: existing.orderId,
    paymentSessionId: existing.paymentSessionId || null,
    amount: existing.totalAmount,
    currency: existing.currency || 'INR',
    ticketPrice: existing.ticketPrice,
    platformFee: existing.platformFee,
    couponCode: existing.couponCode || '',
    couponDiscount: existing.couponDiscount || 0,
    amountBeforeDiscount: existing.amountBeforeDiscount ?? existing.totalAmount,
    amountAfterDiscount: existing.amountAfterDiscount ?? existing.totalAmount,
    totalAmount: existing.totalAmount,
    reusedPendingOrder: true,
    ...extras,
  };
}

module.exports = {
  PENDING_ORDER_WINDOW_MS,
  extractEntityId,
  findReusablePendingOrder,
  buildOrderResponse,
  shouldReuseMappedStatus,
  expireCancelledPaymentOrder,
};
