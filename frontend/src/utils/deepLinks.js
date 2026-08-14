const PENDING_PAYMENT_KEY = 'crwdctrl_pending_payment';
const PAYMENT_RETURN_EXPECTED_KEY = 'crwdctrl_payment_return_expected';
const PENDING_MAX_AGE_MS = 30 * 60 * 1000;
/** Redirect checkout should finish within this window; stale flags must not auto-resume later. */
const RETURN_EXPECTED_MAX_AGE_MS = 10 * 60 * 1000;

function writeBoth(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

function readEither(key) {
  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeBoth(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function resolvePaymentEntityType(returnPath, entityType) {
  if (entityType === 'trek' || entityType === 'fest' || entityType === 'event') return entityType;
  const path = returnPath || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (path.includes('/trek/') && path.includes('/book')) return 'trek';
  if (path.includes('/events/') && path.includes('/register')) return 'event';
  return 'fest';
}

export function isTrekPaymentPending(pending) {
  if (!pending) return false;
  return resolvePaymentEntityType(pending.returnPath, pending.entityType) === 'trek';
}

/** Dual-write so Google Pay / new-tab return still finds pending payment. */
export function storePendingPayment({ orderId, paymentSessionId, returnPath, entityType }) {
  const path = returnPath || window.location.pathname;
  writeBoth(
    PENDING_PAYMENT_KEY,
    JSON.stringify({
      orderId,
      paymentSessionId,
      returnPath: path,
      entityType: resolvePaymentEntityType(path, entityType),
      ts: Date.now(),
    }),
  );
}

export function getPendingPayment() {
  const raw = readEither(PENDING_PAYMENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (isStalePendingPayment(parsed)) {
      clearPendingPayment();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  removeBoth(PENDING_PAYMENT_KEY);
  removeBoth(PAYMENT_RETURN_EXPECTED_KEY);
}

/** Set when redirect checkout is initiated — resume only after Cashfree return. */
export function markPaymentReturnExpected() {
  writeBoth(PAYMENT_RETURN_EXPECTED_KEY, JSON.stringify({ ts: Date.now() }));
}

export function hasPaymentReturnExpected() {
  const raw = readEither(PAYMENT_RETURN_EXPECTED_KEY);
  if (!raw) return false;
  if (raw === '1') {
    removeBoth(PAYMENT_RETURN_EXPECTED_KEY);
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > RETURN_EXPECTED_MAX_AGE_MS) {
      removeBoth(PAYMENT_RETURN_EXPECTED_KEY);
      return false;
    }
    return true;
  } catch {
    removeBoth(PAYMENT_RETURN_EXPECTED_KEY);
    return false;
  }
}

/**
 * Drop abandoned checkout recovery when the user is intentionally opening registration
 * (Register Now) — not returning from Cashfree with return query params.
 */
export function discardStalePaymentRecovery({ pathname, search = '', navigationState = null } = {}) {
  if (hasCashfreeReturnParams(search)) return;
  if (navigationState?.fromPaymentReturn) return;

  if (navigationState?.paymentCancelled) {
    clearPendingPayment();
    return;
  }

  const freshStart =
    navigationState?.freshRegistration
    || navigationState?.prefetch
    || navigationState?.festId
    || navigationState?.competitionId;

  if (freshStart) {
    clearPendingPayment();
    return;
  }

  // Cold revisit without a Cashfree return signal — never auto-resume an old checkout.
  if (getPendingPayment() || hasPaymentReturnExpected()) {
    clearPendingPayment();
  }
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
 * Auto-resume only when the user actually returned from Cashfree for THIS page.
 *
 * We require a real return signal (Cashfree query params like order_id, or the
 * return-expected flag set just before redirect checkout). Without this guard a
 * lingering pending order — e.g. an abandoned/failed payment that only clears on
 * success — would make every normal visit to the page fire a payment verify,
 * causing spurious errors, refetches and lag.
 */
export function shouldResumePendingPayment(pending, currentPath, search = '') {
  if (!pending?.orderId) return false;
  if (!pathsMatchPendingReturn(pending.returnPath, currentPath)) return false;
  if (isStalePendingPayment(pending)) {
    clearPendingPayment();
    return false;
  }
  return hasCashfreeReturnParams(search) || hasPaymentReturnExpected();
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
