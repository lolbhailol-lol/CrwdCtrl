const { verifyCashfreePayment } = require('../services/cashfreeService');

function extractPaymentFields(body = {}) {
  return {
    orderId: body.payment_order_id || body.order_id,
    paymentId: body.payment_id,
  };
}

async function verifyPaymentForRegistration(body) {
  const { orderId, paymentId } = extractPaymentFields(body);

  if (!orderId) {
    return { ok: false, error: 'Payment is required. Missing order ID.' };
  }

  try {
    const result = await verifyCashfreePayment({ orderId, paymentId });
    if (!result.verified) {
      return { ok: false, error: result.message || 'Payment verification failed. Please try again.' };
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
