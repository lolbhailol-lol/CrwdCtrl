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

function buildPendingOrderFilter({
  userId = null,
  customerEmail = null,
  entityType,
  entityId,
  totalAmount,
  people = null,
  couponCode = '',
  gateway = null,
  status = 'PENDING',
}) {
  const since = new Date(Date.now() - PENDING_ORDER_WINDOW_MS);
  const filter = {
    entityType,
    entityId,
    status,
    totalAmount: Number(totalAmount),
    couponCode: String(couponCode || '').trim().toUpperCase(),
    createdAt: { $gte: since },
  };

  if (gateway === 'razorpay') {
    filter.gateway = 'razorpay';
  } else if (gateway === 'cashfree') {
    filter.$or = [
      { gateway: 'cashfree' },
      { gateway: { $exists: false } },
      { gateway: null },
    ];
  }

  if (people != null) filter.people = Number(people);

  if (userId) {
    filter.userId = userId;
  } else if (customerEmail) {
    filter.customerEmail = String(customerEmail).trim().toLowerCase();
  } else {
    return null;
  }

  return filter;
}

/**
 * Reuse a recent pending order for the same user/guest + entity + amount
 * to prevent duplicate charges on double-submit.
 *
 * For Razorpay: only `created` / `attempted` are reusable for checkout.
 * If Razorpay already marked the order `paid`, return the row with
 * `_alreadyPaidAtGateway` so the caller can skip checkout and finish verify/booking.
 */
async function findReusablePendingOrder({
  userId = null,
  customerEmail = null,
  entityType,
  entityId,
  totalAmount,
  people = null,
  couponCode = '',
  gateway = null,
}) {
  if (!entityType || !entityId || !totalAmount) return null;

  const filter = buildPendingOrderFilter({
    userId,
    customerEmail,
    entityType,
    entityId,
    totalAmount,
    people,
    couponCode,
    gateway,
    status: 'PENDING',
  });
  if (!filter) return null;

  // Must return a Mongoose document (not lean) — createOrder may call .save()
  // to refresh registrationDraft on reused pending sessions.
  const existing = await PaymentOrder.findOne(filter).sort({ createdAt: -1 });
  if (!existing) {
    // Recovery: money may already be captured (PaymentOrder PAID) while booking failed
    if (gateway === 'razorpay') {
      const paidFilter = buildPendingOrderFilter({
        userId,
        customerEmail,
        entityType,
        entityId,
        totalAmount,
        people,
        couponCode,
        gateway,
        status: 'PAID',
      });
      if (!paidFilter) return null;
      const paid = await PaymentOrder.findOne(paidFilter).sort({ createdAt: -1 });
      if (paid?.orderId) {
        paid._alreadyPaidAtGateway = true;
        return paid;
      }
    }
    return null;
  }

  // Organizer Razorpay orders: confirm the Razorpay order is still usable for checkout
  if (existing.gateway === 'razorpay') {
    if (!existing.orderId) return null;
    try {
      const { fetchRazorpayOrder } = require('../services/razorpayService');
      const rzOrder = await fetchRazorpayOrder(existing.orderId);
      const status = String(rzOrder?.status || '').toLowerCase();
      if (status === 'created' || status === 'attempted') {
        return existing;
      }
      if (status === 'paid') {
        // Do NOT reopen Checkout on a completed order — signal already-paid recovery
        if (existing.status !== 'PAID') {
          existing.status = 'PAID';
          await existing.save().catch(() => {});
        }
        existing._alreadyPaidAtGateway = true;
        return existing;
      }
      existing.status = status === 'failed' ? 'FAILED' : 'EXPIRED';
      await existing.save().catch(() => {});
      return null;
    } catch {
      // Razorpay unreachable: keep pending so double-tap cannot open two charges
      return existing;
    }
  }

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
    gateway: existing.gateway || 'cashfree',
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
