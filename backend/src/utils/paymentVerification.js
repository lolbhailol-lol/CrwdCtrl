const { verifyCashfreePayment } = require('../services/cashfreeService');
const { verifyRazorpayPayment } = require('../services/razorpayService');

function extractPaymentFields(body = {}) {
  return {
    orderId:
      body.payment_order_id
      || body.razorpay_order_id
      || body.order_id
      || body.orderId
      || body.orderID,
    paymentId:
      body.payment_id
      || body.razorpay_payment_id
      || body.cf_payment_id
      || body.paymentId,
    signature:
      body.razorpay_signature
      || body.signature
      || null,
  };
}

function validateStoredPaymentOrder(paymentOrder, {
  expectedTotalAmount = null,
  entityId = null,
  entityType = null,
  userId = null,
} = {}) {
  if (!paymentOrder) return { ok: false, error: 'Payment order was not found.' };
  if (userId && String(paymentOrder.userId || '') !== String(userId)) {
    return { ok: false, error: 'Payment order does not belong to this user.' };
  }
  if (entityType && String(paymentOrder.entityType || '') !== String(entityType)) {
    return { ok: false, error: 'Payment order does not match this registration.' };
  }
  if (entityId && String(paymentOrder.entityId || '') !== String(entityId)) {
    return { ok: false, error: 'Payment order does not match this registration.' };
  }
  if (expectedTotalAmount != null && Number(expectedTotalAmount) > 0) {
    const storedAmount = Number(paymentOrder.totalAmount);
    if (!Number.isFinite(storedAmount) || storedAmount !== Number(expectedTotalAmount)) {
      return { ok: false, error: 'Payment amount does not match expected total.' };
    }
  }
  return { ok: true };
}

async function verifyPaymentForRegistration(body, {
  expectedTotalAmount = null,
  entityId = null,
  entityType = null,
  userId = null,
} = {}) {
  const { orderId, paymentId, signature } = extractPaymentFields(body);

  if (!orderId) {
    return { ok: false, error: 'Payment is required. Missing order ID.', code: 'MISSING_ORDER_ID' };
  }

  try {
    const PaymentOrder = require('../model/payment_order_model');
    const paymentOrder = await PaymentOrder.findOne({ orderId: String(orderId) })
      .select('gateway cashfreeMerchant status paymentId totalAmount entityType entityId userId')
      .lean();
    const binding = validateStoredPaymentOrder(paymentOrder, {
      expectedTotalAmount,
      entityId,
      entityType,
      userId,
    });
    if (!binding.ok) return binding;

    // The authenticated /payment/verify route or signed webhook has already
    // verified this order with Cashfree. Reuse that authoritative result so a
    // registration rush does not make a second gateway request per attendee.
    if (String(paymentOrder.status || '').toUpperCase() === 'PAID') {
      return {
        ok: true,
        orderId: String(orderId),
        paymentId: paymentOrder.paymentId || paymentId || null,
        amountPaid: Number(paymentOrder.totalAmount) || null,
        locallyVerified: true,
      };
    }
    const merchant = paymentOrder?.cashfreeMerchant === 'events' ? 'events' : 'platform';

    const result = paymentOrder.gateway === 'razorpay'
      ? await verifyRazorpayPayment({ orderId, paymentId, signature })
      : await verifyCashfreePayment({ orderId, paymentId, merchant });
    if (!result.verified) {
      return {
        ok: false,
        error: result.message || 'Payment verification failed. Please try again.',
        code: result.code,
        status: result.status,
        retryable: result.retryable,
      };
    }

    if (
      paymentOrder.gateway !== 'razorpay'
      && expectedTotalAmount != null
      && Number(expectedTotalAmount) > 0
    ) {
      const { fetchOrder } = require('../services/cashfreeService');
      try {
        const cashfreeOrder = await fetchOrder(orderId, { merchant });
        const paidAmount = Number(cashfreeOrder.order_amount);
        if (paidAmount !== Number(expectedTotalAmount)) {
          return { ok: false, error: 'Payment amount does not match expected total.' };
        }
        if (entityId) {
          const tags = cashfreeOrder.order_tags || {};
          const tagEntityId =
            tags.eventShowId || tags.trekId || tags.eventId || tags.competitionId || tags.festId;
          if (tagEntityId && String(tagEntityId) !== String(entityId)) {
            return { ok: false, error: 'Payment order does not match this registration.' };
          }
        }
      } catch (tagErr) {
        console.error('Payment tag validation error:', tagErr.message);
        return { ok: false, error: 'Unable to validate payment order details.' };
      }
    }

    await PaymentOrder.updateOne(
      { _id: paymentOrder._id },
      {
        $set: {
          status: 'PAID',
          ...(result.paymentId ? { paymentId: String(result.paymentId) } : {}),
        },
      },
    );

    return {
      ok: true,
      orderId: result.orderId,
      paymentId: result.paymentId,
      amountPaid: Number(paymentOrder.totalAmount) || null,
    };
  } catch (err) {
    console.error('Cashfree verification error:', err.response?.data || err.message);
    return { ok: false, error: 'Payment verification failed. Please try again.' };
  }
}

module.exports = {
  extractPaymentFields,
  validateStoredPaymentOrder,
  verifyPaymentForRegistration,
};
