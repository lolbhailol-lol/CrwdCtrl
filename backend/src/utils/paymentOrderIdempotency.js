const PaymentOrder = require('../model/payment_order_model');

const PENDING_ORDER_WINDOW_MS = 10 * 60 * 1000;

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
}) {
  if (!entityType || !entityId || !totalAmount) return null;

  const since = new Date(Date.now() - PENDING_ORDER_WINDOW_MS);
  const filter = {
    entityType,
    entityId,
    status: 'PENDING',
    totalAmount: Number(totalAmount),
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

  return PaymentOrder.findOne(filter).sort({ createdAt: -1 }).lean();
}

function buildOrderResponse(existing, extras = {}) {
  return {
    orderId: existing.orderId,
    paymentSessionId: existing.paymentSessionId || null,
    amount: existing.totalAmount,
    currency: existing.currency || 'INR',
    ticketPrice: existing.ticketPrice,
    platformFee: existing.platformFee,
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
};
