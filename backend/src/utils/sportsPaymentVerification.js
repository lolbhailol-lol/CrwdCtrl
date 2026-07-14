const CategoryRegistration = require('../model/category_registration_model');
const PaymentOrder = require('../model/payment_order_model');
const { verifyCashfreePayment, fetchOrder } = require('../services/cashfreeService');
const { buildPriceBreakdown } = require('./platformFee');

/**
 * Server-side payment verification for run (sports) bookings.
 * Security: never trust client amountPaid — prefer PaymentOrder / Cashfree tags
 * (includes coupon-discounted total). Fall back to full fee breakdown only when
 * the order has no coupon and no stored amount.
 */
async function verifySportsBookingPayment({ event, people, paymentOrderId, paymentId }) {
  if (!paymentOrderId) {
    return { ok: false, status: 400, message: 'payment_order_id is required for paid runs' };
  }

  // Idempotency: one Cashfree order → one registration
  const existing = await CategoryRegistration.findOne({ payment_order_id: paymentOrderId }).lean();
  if (existing) {
    return { ok: false, status: 409, message: 'This payment has already been used for a registration' };
  }

  const paymentResult = await verifyCashfreePayment({ orderId: paymentOrderId, paymentId });
  if (!paymentResult.verified) {
    return {
      ok: false,
      status: 400,
      message: paymentResult.message || 'Payment verification failed',
    };
  }

  const expectedPeople = Math.max(1, Number(people) || 1);
  const ticketPricePerPerson = Number(event.registrationFee) || 0;
  const { totalAmount: fullPriceTotal } = buildPriceBreakdown(ticketPricePerPerson * expectedPeople);

  const paymentOrder = await PaymentOrder.findOne({ orderId: paymentOrderId }).lean();

  let orderTags = {};
  try {
    const cashfreeOrder = await fetchOrder(paymentOrderId);
    orderTags = cashfreeOrder.order_tags || {};
  } catch (err) {
    console.error('[sportsPaymentVerification] fetchOrder error:', err.message);
    return { ok: false, status: 400, message: 'Unable to validate payment order details' };
  }

  const taggedEventId = orderTags.eventId || (paymentOrder?.entityId ? String(paymentOrder.entityId) : '');
  if (taggedEventId && String(taggedEventId) !== String(event._id)) {
    return { ok: false, status: 400, message: 'Payment order does not match this run' };
  }

  const taggedPeople = orderTags.people != null
    ? Number(orderTags.people)
    : (paymentOrder?.people != null ? Number(paymentOrder.people) : null);
  if (taggedPeople != null && taggedPeople !== expectedPeople) {
    return { ok: false, status: 400, message: 'Payment people count does not match booking' };
  }

  // Discounted total: PaymentOrder / Cashfree tags win over full-price breakdown
  const expectedTotal = (() => {
    if (paymentOrder?.totalAmount != null && Number.isFinite(Number(paymentOrder.totalAmount))) {
      return Number(paymentOrder.totalAmount);
    }
    if (orderTags.totalAmount != null && Number.isFinite(Number(orderTags.totalAmount))) {
      return Number(orderTags.totalAmount);
    }
    return fullPriceTotal;
  })();

  if (orderTags.totalAmount != null && Number(orderTags.totalAmount) !== expectedTotal) {
    // Prefer PaymentOrder when tags disagree after coupon; still reject wild mismatches
    if (paymentOrder?.totalAmount == null) {
      return { ok: false, status: 400, message: 'Payment amount does not match expected total' };
    }
  }

  await PaymentOrder.findOneAndUpdate(
    { orderId: paymentOrderId },
    { status: 'PAID', paymentId: paymentResult.paymentId },
    { new: true },
  );

  return {
    ok: true,
    paymentId: paymentResult.paymentId,
    amountPaid: expectedTotal,
    couponCode: String(paymentOrder?.couponCode || orderTags.couponCode || '').trim().toUpperCase(),
    couponDiscount: Number(paymentOrder?.couponDiscount ?? orderTags.couponDiscount) || 0,
    amountBeforeDiscount: Number(
      paymentOrder?.amountBeforeDiscount
      ?? orderTags.amountBeforeDiscount
      ?? expectedTotal,
    ) || expectedTotal,
  };
}

module.exports = { verifySportsBookingPayment };
