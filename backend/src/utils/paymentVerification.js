const { verifyCashfreePayment } = require('../services/cashfreeService');

function extractPaymentFields(body = {}) {
  return {
    orderId:
      body.payment_order_id
      || body.order_id
      || body.orderId
      || body.orderID,
    paymentId:
      body.payment_id
      || body.cf_payment_id
      || body.paymentId,
  };
}

async function verifyPaymentForRegistration(body, { expectedTotalAmount = null, entityId = null } = {}) {
  const { orderId, paymentId } = extractPaymentFields(body);

  if (!orderId) {
    return { ok: false, error: 'Payment is required. Missing order ID.', code: 'MISSING_ORDER_ID' };
  }

  try {
    const result = await verifyCashfreePayment({ orderId, paymentId });
    if (!result.verified) {
      return {
        ok: false,
        error: result.message || 'Payment verification failed. Please try again.',
        code: result.code,
        status: result.status,
        retryable: result.retryable,
      };
    }

    if (expectedTotalAmount != null && Number(expectedTotalAmount) > 0) {
      const { fetchOrder } = require('../services/cashfreeService');
      try {
        const cashfreeOrder = await fetchOrder(orderId);
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

    return {
      ok: true,
      orderId: result.orderId,
      paymentId: result.paymentId,
    };
  } catch (err) {
    console.error('Cashfree verification error:', err.response?.data || err.message);
    return { ok: false, error: 'Payment verification failed. Please try again.' };
  }
}

module.exports = { extractPaymentFields, verifyPaymentForRegistration };
