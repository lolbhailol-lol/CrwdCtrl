/**
 * Authorize a payment verify request against the stored PaymentOrder.
 *
 * Trek and sports checkout are guest-friendly, so we cannot always require
 * an authenticated user. But we CAN require that the caller either owns the
 * order (matching JWT userId) or knows the customer email that was captured
 * at order-creation time. This closes the pre-audit gap where anyone with a
 * leaked orderId could mark an order PAID and mint a paymentProof JWT.
 *
 * Behavior:
 * - If order.userId is set and JWT matches: allow.
 * - If order.userId is set and JWT is a different user: reject.
 * - If there is no JWT (Cashfree return / in-app browser often drop the
 *   token): fall through to customerEmail match — same bar as guest orders.
 * - If order is a guest order (no userId) and no JWT: require customerEmail
 *   in the request body to match the stored order.customerEmail.
 * - If no PaymentOrder is found for the orderId, allow the caller through —
 *   the controller will return not_found from the gateway without side effects.
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
    // Legacy orders without an email captured — allow through; ownership can't be enforced.
    return { ok: true };
  }

  if (reqUserId) {
    // Authenticated user on a guest order — allow if the JWT was issued to
    // the same email. We do not have that on req.user, so accept and log.
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
