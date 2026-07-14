const TrekBooking = require('../model/trek_booking_model');
const PaymentOrder = require('../model/payment_order_model');
const { verifyCashfreePayment, fetchOrder } = require('../services/cashfreeService');
const { buildTrekPriceBreakdown } = require('./platformFee');
const { resolveTrekPlatformFeePercent } = require('./trekRegistrationFee');

/**
 * Server-side payment verification for trek bookings.
 * Security: never trust client amountPaid — re-verify with Cashfree and validate order tags.
 */
async function verifyTrekBookingPayment({ trek, people, paymentOrderId, paymentId }) {
  if (!paymentOrderId) {
    return { ok: false, status: 400, message: 'payment_order_id is required for paid treks' };
  }

  // Idempotency: one Cashfree order → one booking
  const existingBooking = await TrekBooking.findOne({ payment_order_id: paymentOrderId }).lean();
  if (existingBooking) {
    return { ok: false, status: 409, message: 'This payment has already been used for a booking' };
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
  const ticketPricePerPerson = Number(trek.registrationFee) || 0;
  const platformFeePercent = resolveTrekPlatformFeePercent(trek.platformFeePercent, 3);
    const { totalAmount: expectedTotal } = buildTrekPriceBreakdown(
      ticketPricePerPerson * expectedPeople,
      platformFeePercent,
    );

  let orderTags = {};
  try {
    const cashfreeOrder = await fetchOrder(paymentOrderId);
    orderTags = cashfreeOrder.order_tags || {};
  } catch (err) {
    console.error('[trekPaymentVerification] fetchOrder error:', err.message);
    return { ok: false, status: 400, message: 'Unable to validate payment order details' };
  }

  if (orderTags.trekId && String(orderTags.trekId) !== String(trek._id)) {
    return { ok: false, status: 400, message: 'Payment order does not match this trek' };
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

module.exports = { verifyTrekBookingPayment };
