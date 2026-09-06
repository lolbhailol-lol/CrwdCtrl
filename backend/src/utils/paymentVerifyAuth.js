/**
 * Authorize a payment verify request against the stored PaymentOrder.
 *
 * Trek and sports checkout are guest-friendly, so we cannot always require
 * an authenticated user. But we CAN require that the caller either owns the
 * order (matching JWT userId) or knows the customer email that was captured
 * at order-creation time.
 */
function authorizePaymentVerify({ paymentOrder, req }) {
  if (!paymentOrder) {
    return { ok: true };
  }

  const orderUserId = paymentOrder.userId ? String(paymentOrder.userId) : '';
  const reqUserId = req.user?.userId ? String(req.user.userId) : '';

  if (orderUserId && reqUserId) {
    if (reqUserId === orderUserId) {
      return { ok: true };
    }
    return {
      ok: false,
      status: 401,
      code: 'ORDER_OWNERSHIP_MISMATCH',
      message: 'This payment belongs to a different account. Sign in and try again.',
    };
  }

  const orderEmail = String(paymentOrder.customerEmail || '').trim().toLowerCase();
  if (!orderEmail) {
    return { ok: true };
  }

  if (reqUserId) {
    return { ok: true };
  }

  const bodyEmail = String(req.body?.customerEmail || req.body?.email || '')
    .trim()
    .toLowerCase();
  if (bodyEmail && bodyEmail === orderEmail) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    code: 'ORDER_EMAIL_REQUIRED',
    message: 'Include the email used at checkout to verify this payment.',
  };
}

module.exports = { authorizePaymentVerify };
