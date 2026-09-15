const { logger } = require('./logger');

/**
 * Send structured verify response — HTTP 200 for all outcomes except missing orderId / not found.
 */
function sendVerifyResponse(res, result, extras = {}) {
  const body = {
    verified: Boolean(result.verified),
    status: result.status || (result.verified ? 'paid' : 'failed'),
    code: result.code || (result.verified ? 'PAYMENT_PAID' : 'PAYMENT_FAILED'),
    message: result.message || (result.verified ? 'Payment confirmed.' : 'Payment verification failed'),
    retryable: Boolean(result.retryable),
    payment_order_id: result.orderId || null,
    payment_id: result.paymentId || null,
    order_status: result.orderStatus || null,
    ...extras,
  };

  if (result.status === 'not_found') {
    return res.status(404).json(body);
  }

  if (!result.verified && result.status === 'pending') {
    logger.debug('[payment.verify] pending', { orderId: result.orderId, code: body.code });
  } else if (result.verified) {
    logger.debug('[payment.verify] paid', { orderId: result.orderId });
  } else if (result.status === 'cancelled') {
    logger.debug('[payment.verify] cancelled', { orderId: result.orderId });
  }

  return res.status(200).json(body);
}

module.exports = { sendVerifyResponse };
