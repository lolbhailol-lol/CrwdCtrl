const TrekBooking = require('../model/trek_booking_model');
const PaymentOrder = require('../model/payment_order_model');
const { verifyCashfreePayment, fetchOrder } = require('../services/cashfreeService');
const { verifyRazorpayPayment } = require('../services/razorpayService');
const { toSlug } = require('./slug');

function trekIdsMatch(tagTrekId, trek) {
  if (!tagTrekId) return true;
  const tag = String(tagTrekId).trim();
  const id = String(trek._id);
  if (tag === id) return true;
  const nameSlug = toSlug(trek.trekName || trek.title || '');
  const storedSlug = toSlug(trek.slug || '');
  const tagSlug = toSlug(tag);
  return (nameSlug && tagSlug === nameSlug) || (storedSlug && tagSlug === storedSlug);
}

/**
 * Server-side payment verification for trek bookings.
 * Security: never trust client amountPaid — re-verify with Cashfree or Razorpay.
 */
async function verifyTrekBookingPayment({ trek, people, paymentOrderId, paymentId, signature = null }) {
  if (!paymentOrderId) {
    return { ok: false, status: 400, message: 'payment_order_id is required for paid treks' };
  }

  // Idempotency: one gateway order → one booking
  const existingBooking = await TrekBooking.findOne({ payment_order_id: paymentOrderId }).lean();
  if (existingBooking) {
    return { ok: false, status: 409, message: 'This payment has already been used for a booking' };
  }

  const paymentOrder = await PaymentOrder.findOne({ orderId: paymentOrderId }).lean();
  const gateway = paymentOrder?.gateway === 'razorpay' ? 'razorpay' : 'cashfree';

  let paymentResult;
  if (gateway === 'razorpay') {
    paymentResult = await verifyRazorpayPayment({
      orderId: paymentOrderId,
      paymentId,
      signature,
    });
  } else {
    paymentResult = await verifyCashfreePayment({ orderId: paymentOrderId, paymentId });
  }

  if (!paymentResult.verified) {
    return {
      ok: false,
      status: 400,
      message: paymentResult.message || 'Payment verification failed',
    };
  }

  const expectedPeople = Math.max(1, Number(people) || 1);

  if (paymentOrder) {
    if (paymentOrder.entityType && paymentOrder.entityType !== 'trek') {
      return { ok: false, status: 400, message: 'Payment order does not match this trek' };
    }
    if (paymentOrder.entityId && String(paymentOrder.entityId) !== String(trek._id)) {
      return { ok: false, status: 400, message: 'Payment order does not match this trek' };
    }
    if (paymentOrder.people != null && Number(paymentOrder.people) !== expectedPeople) {
      return { ok: false, status: 400, message: 'Payment people count does not match booking' };
    }
  }

  let orderTags = {};
  if (gateway === 'cashfree') {
    try {
      const cashfreeOrder = await fetchOrder(paymentOrderId);
      orderTags = cashfreeOrder.order_tags || {};
    } catch (err) {
      console.error('[trekPaymentVerification] fetchOrder error:', err.message);
      if (!paymentOrder) {
        return { ok: false, status: 400, message: 'Unable to validate payment order details' };
      }
    }
  } else if (paymentOrder?.orderTags) {
    orderTags = paymentOrder.orderTags;
  }

  if (orderTags.trekId && !trekIdsMatch(orderTags.trekId, trek)) {
    return { ok: false, status: 400, message: 'Payment order does not match this trek' };
  }
  if (orderTags.people && Number(orderTags.people) !== expectedPeople) {
    return { ok: false, status: 400, message: 'Payment people count does not match booking' };
  }

  const amountPaid = paymentOrder?.totalAmount != null
    ? Number(paymentOrder.totalAmount)
    : (orderTags.totalAmount != null ? Number(orderTags.totalAmount) : null);

  if (amountPaid == null || Number.isNaN(amountPaid) || amountPaid < 0) {
    return { ok: false, status: 400, message: 'Unable to resolve paid amount for this order' };
  }

  await PaymentOrder.findOneAndUpdate(
    { orderId: paymentOrderId },
    { status: 'PAID', paymentId: paymentResult.paymentId },
    { new: true },
  );

  return {
    ok: true,
    paymentId: paymentResult.paymentId,
    amountPaid,
    gateway,
  };
}

module.exports = { verifyTrekBookingPayment };
