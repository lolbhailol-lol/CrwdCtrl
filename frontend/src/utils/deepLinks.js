const PENDING_PAYMENT_KEY = 'crwdctrl_pending_payment';
const PAYMENT_RETURN_EXPECTED_KEY = 'crwdctrl_payment_return_expected';
const PENDING_MAX_AGE_MS = 30 * 60 * 1000;

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
  sessionStorage.removeItem(PAYMENT_RETURN_EXPECTED_KEY);
}

/** Set when redirect checkout is initiated — resume only after Cashfree return. */
export function markPaymentReturnExpected() {
  sessionStorage.setItem(PAYMENT_RETURN_EXPECTED_KEY, '1');
}

export function hasPaymentReturnExpected() {
  return sessionStorage.getItem(PAYMENT_RETURN_EXPECTED_KEY) === '1';
}

export function pathsMatchPendingReturn(pendingPath, currentPath) {
  if (!pendingPath || !currentPath) return false;
  return pendingPath.split('?')[0] === currentPath.split('?')[0];
}

export function hasCashfreeReturnParams(search = '') {
  const params = new URLSearchParams(search);
  return (
    params.has('order_id') ||
    params.has('order_token') ||
    params.has('cf_payment_id') ||
    params.has('payment_id')
  );
}

export function isStalePendingPayment(pending) {
  if (!pending?.ts) return false;
  return Date.now() - pending.ts > PENDING_MAX_AGE_MS;
}

/**
 * Only auto-resume payment when user likely returned from Cashfree (not stale abandoned checkout).
 */
export function shouldResumePendingPayment(pending, currentPath, search = '') {
  if (!pending?.orderId) return false;
  if (!pathsMatchPendingReturn(pending.returnPath, currentPath)) return false;
  if (isStalePendingPayment(pending)) {
    clearPendingPayment();
    return false;
  }
  return hasPaymentReturnExpected() || hasCashfreeReturnParams(search);
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
