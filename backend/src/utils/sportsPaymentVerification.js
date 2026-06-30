const CategoryRegistration = require('../model/category_registration_model');
const PaymentOrder = require('../model/payment_order_model');
const { verifyCashfreePayment, fetchOrder } = require('../services/cashfreeService');
const { buildPriceBreakdown } = require('./platformFee');

/**
 * Server-side payment verification for run (sports) bookings.
 * Security: never trust client amountPaid — re-verify with Cashfree and validate order tags.
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
  const { totalAmount: expectedTotal } = buildPriceBreakdown(ticketPricePerPerson * expectedPeople);

  let orderTags = {};
  try {
    const cashfreeOrder = await fetchOrder(paymentOrderId);
    orderTags = cashfreeOrder.order_tags || {};
  } catch (err) {
    console.error('[sportsPaymentVerification] fetchOrder error:', err.message);
    return { ok: false, status: 400, message: 'Unable to validate payment order details' };
  }

  if (orderTags.eventId && String(orderTags.eventId) !== String(event._id)) {
    return { ok: false, status: 400, message: 'Payment order does not match this run' };
  }
  if (orderTags.people && Number(orderTags.people) !== expectedPeople) {
    return { ok: false, status: 400, message: 'Payment people count does not match booking' };
  }
  if (orderTags.totalAmount && Number(orderTags.totalAmount) !== expectedTotal) {
    return { ok: false, status: 400, message: 'Payment amount does not match expected total' };
  }

  await PaymentOrder.findOneAndUpdate(
    { orderId: paymentOrderId },
    { status: 'PAID', paymentId: paymentResult.paymentId },
    { new: true }
  );

  return {
    ok: true,
    paymentId: paymentResult.paymentId,
    amountPaid: expectedTotal,
  };
}

module.exports = { verifySportsBookingPayment };
