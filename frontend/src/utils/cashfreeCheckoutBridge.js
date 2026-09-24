import { PUBLIC_WEB_ORIGIN } from './publicWebOrigin.js';

export function normalizeCashfreeMode(mode) {
  return mode === 'sandbox' ? 'sandbox' : 'production';
}

function checkoutOrigin(explicitOrigin = '') {
  if (explicitOrigin) return String(explicitOrigin).replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return window.location.origin;
  }
  return PUBLIC_WEB_ORIGIN;
}

/**
 * A tiny same-site bridge unloads the large registration page before Cashfree/UPI handoff.
 * Production always uses the canonical www host so in-app browsers avoid an extra 308.
 */
export function buildCashfreeCheckoutBridgeUrl({
  paymentSessionId,
  orderId = '',
  cashfreeMode = 'production',
  origin = '',
}) {
  const params = new URLSearchParams({
    payment_session_id: String(paymentSessionId || '').trim(),
    order_id: String(orderId || '').trim(),
    mode: normalizeCashfreeMode(cashfreeMode),
  });
  return `${checkoutOrigin(origin)}/payment/checkout?${params.toString()}`;
}
