const PENDING_PAYMENT_KEY = 'crwdctrl_pending_payment';

export function resolvePaymentEntityType(returnPath, entityType) {
  if (entityType === 'trek' || entityType === 'fest') return entityType;
  const path = returnPath || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (path.includes('/trek/') && path.includes('/book')) return 'trek';
  return 'fest';
}

export function isTrekPaymentPending(pending) {
  if (!pending) return false;
  return resolvePaymentEntityType(pending.returnPath, pending.entityType) === 'trek';
}

export function storePendingPayment({ orderId, paymentSessionId, returnPath, entityType }) {
  const path = returnPath || window.location.pathname;
  sessionStorage.setItem(
    PENDING_PAYMENT_KEY,
    JSON.stringify({
      orderId,
      paymentSessionId,
      returnPath: path,
      entityType: resolvePaymentEntityType(path, entityType),
      ts: Date.now(),
    })
  );
}

export function getPendingPayment() {
  const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  sessionStorage.removeItem(PENDING_PAYMENT_KEY);
}

/**
 * Parse app URL / universal link into in-app path.
 * Supports: https://www.crwdctrl.in/path, crwdctrl://path, /path
 */
export function pathFromAppUrl(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    if (url.startsWith('/')) return url.split('?')[0];

    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'crwdctrl.in' || host === 'localhost') {
      return parsed.pathname + parsed.search;
    }

    if (parsed.protocol === 'crwdctrl:') {
      return `/${parsed.hostname}${parsed.pathname}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    }
  } catch {
    return null;
  }

  return null;
}

export function isPaymentReturnUrl(url) {
  const path = pathFromAppUrl(url);
  return path?.includes('/payment/return') || url.includes('payment');
}
