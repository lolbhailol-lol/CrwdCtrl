/** Shared post-payment navigation — keeps redirects fast and consistent */

import { clearPendingPayment } from './deepLinks';
import { resolveAuthToken } from './authToken';

export const BOOKING_REDIRECT_MS = 400;
/** Per-attempt inner retries inside one verify call. */
export const PAYMENT_VERIFY_RETRY_MS = [300, 500, 800, 1200, 2000];
/** Max wait on /payment/return before handing off to the booking page. */
export const PAYMENT_RETURN_MAX_WAIT_MS = 4500;
/** Background poll on fest/event/booking pages (user sees “Finishing…” overlay). */
export const PAYMENT_BACKGROUND_MAX_WAIT_MS = 45000;
/** Gaps between poll rounds (background only). */
export const PAYMENT_POLL_INTERVAL_MS = [600, 800, 1000, 1500, 2000, 3000];
/** @deprecated use PAYMENT_BACKGROUND_MAX_WAIT_MS */
export const PAYMENT_POLL_MAX_WAIT_MS = PAYMENT_BACKGROUND_MAX_WAIT_MS;

export function goToBookings(navigate, pendingBooking = null) {
  navigate('/booking', {
    replace: true,
    state: {
      refreshBookings: true,
      ...(pendingBooking ? { pendingBooking } : {}),
    },
  });
}

export function scheduleGoToBookings(navigate, delayMs = BOOKING_REDIRECT_MS) {
  window.setTimeout(() => goToBookings(navigate), delayMs);
}

export function goToTicketOrBookings(navigate, regId) {
  if (regId) {
    navigate(`/qr-ticket/${regId}`, {
      replace: true,
      state: { refreshBookings: true, fromPayment: true },
    });
    return;
  }
  goToBookings(navigate);
}

export function scheduleTicketOrBookings(navigate, regId, delayMs = BOOKING_REDIRECT_MS) {
  window.setTimeout(() => goToTicketOrBookings(navigate, regId), delayMs);
}

export function getCashfreeReturnPaymentId(search = '') {
  const params = new URLSearchParams(search);
  return params.get('cf_payment_id') || params.get('payment_id') || null;
}

/**
 * Mirror backend verify codes into a stable client shape.
 */
export function classifyVerifyResponse(data = {}, httpStatus = 200) {
  const verified = Boolean(data?.verified);
  const status = data?.status || (verified ? 'paid' : 'failed');
  const code = data?.code || (verified ? 'PAYMENT_PAID' : 'PAYMENT_FAILED');
  const retryable = data?.retryable ?? status === 'pending';

  return {
    verified,
    status,
    code,
    message: data?.message || '',
    retryable,
    data,
    httpStatus,
  };
}

/**
 * Map verify outcome to UI kind + user-safe message.
 * Returns { kind: 'paid' | 'pending' | 'cancelled' | 'network' | 'failed', message }.
 */
export function classifyVerifyError(result = {}) {
  const status = result.status || result.classified?.status;
  const code = result.code || result.classified?.code;
  const message = result.data?.message || result.message || result.classified?.message || '';

  if (status === 'cancelled' || code === 'PAYMENT_CANCELLED') {
    return {
      kind: 'cancelled',
      message: message || 'Payment was cancelled. You can try again when ready.',
    };
  }

  if (status === 'pending' || code === 'PAYMENT_PENDING') {
    return {
      kind: 'pending',
      message: message || 'Payment is still processing. Please wait a moment…',
    };
  }

  if (code === 'ORDER_OWNERSHIP_MISMATCH') {
    return {
      kind: 'failed',
      message: message || 'This payment belongs to a different account. Sign in and try again.',
    };
  }

  if (code === 'ORDER_EMAIL_REQUIRED') {
    return {
      kind: 'failed',
      message: message || 'Use the same email from checkout to confirm this payment.',
    };
  }

  if (
    code === 'NETWORK_ERROR'
    || /network|timeout|timed out|offline|internet|connection|failed to fetch/i.test(message)
  ) {
    return {
      kind: 'network',
      message: 'We couldn’t verify your payment. Check your connection and try again.',
    };
  }

  return {
    kind: 'failed',
    message: message || 'Payment could not be verified.',
  };
}

export function clearCashfreeReturnAndPending(navigate, location) {
  clearPendingPayment();
  try {
    const pathname = location?.pathname || window.location.pathname;
    const params = new URLSearchParams(location?.search || window.location.search);
    ['order_id', 'order_token', 'cf_payment_id', 'payment_id'].forEach((key) => params.delete(key));
    const nextSearch = params.toString();
    if (navigate) {
      navigate(
        { pathname, search: nextSearch ? `?${nextSearch}` : '' },
        { replace: true },
      );
    } else {
      const url = nextSearch ? `${pathname}?${nextSearch}` : pathname;
      window.history.replaceState({}, '', url);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Verify Cashfree payment with retries (webhook / redirect lag).
 * @param {'fest'|'trek'|'sports'} kind
 */
export async function verifyPaymentWithRetry(
  apiBase,
  orderId,
  { token = null, kind = 'fest', paymentId = null, search = '', customerEmail = '' } = {},
) {
  const endpoint =
    kind === 'trek' ? `${apiBase}/payment/trek-verify`
    : kind === 'sports' ? `${apiBase}/payment/sports-verify`
    : `${apiBase}/payment/verify`;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const authToken = token || resolveAuthToken();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const resolvedPaymentId = paymentId || getCashfreeReturnPaymentId(search);
  const body = { payment_order_id: orderId };
  if (resolvedPaymentId) body.payment_id = resolvedPaymentId;
  // Guest-friendly verify: server binds trek/sports orders to userId when present,
  // else it falls back to the customerEmail captured at order creation.
  const email = String(customerEmail || '').trim();
  if (email) body.customerEmail = email;

  const maxAttempts = PAYMENT_VERIFY_RETRY_MS.length + 1;
  let lastData = null;
  let lastRes = null;
  let lastClassified = classifyVerifyResponse({}, 0);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      lastRes = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'include',
      });
    } catch (networkErr) {
      lastClassified = classifyVerifyResponse({
        verified: false,
        status: 'failed',
        code: 'NETWORK_ERROR',
        message: networkErr?.message || 'Network error during verification',
        retryable: true,
      }, 0);
      if (attempt === maxAttempts - 1) break;
      await new Promise((r) => setTimeout(r, PAYMENT_VERIFY_RETRY_MS[attempt] || 1500));
      continue;
    }

    lastData = await lastRes.json().catch(() => ({}));
    lastClassified = classifyVerifyResponse(lastData, lastRes.status);

    if (lastClassified.verified) {
      return {
        ok: true,
        verified: true,
        status: 'paid',
        code: lastClassified.code,
        data: lastData,
        response: lastRes,
        classified: lastClassified,
      };
    }

    if (lastClassified.status === 'cancelled' || (lastClassified.status === 'failed' && !lastClassified.retryable)) {
      break;
    }

    if (attempt < maxAttempts - 1 && (lastClassified.status === 'pending' || lastClassified.retryable)) {
      await new Promise((r) => setTimeout(r, PAYMENT_VERIFY_RETRY_MS[attempt] || 1500));
      continue;
    }

    break;
  }

  return {
    ok: false,
    verified: false,
    status: lastClassified.status,
    code: lastClassified.code,
    data: lastData,
    response: lastRes,
    classified: lastClassified,
  };
}

const CASHFREE_QUERY_KEYS = ['order_id', 'order_token', 'cf_payment_id', 'payment_id'];

export function stripCashfreeReturnParams(search = '') {
  const params = new URLSearchParams(search);
  CASHFREE_QUERY_KEYS.forEach((key) => params.delete(key));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Navigate to registration/booking page — finish verify there (fast handoff). */
export function handoffPaymentToReturnPath(navigate, returnPath, extraState = {}) {
  if (!returnPath || !navigate) return;
  const [path, existingQuery = ''] = String(returnPath).split('?');
  const merged = new URLSearchParams(existingQuery);
  CASHFREE_QUERY_KEYS.forEach((key) => merged.delete(key));
  const qs = merged.toString();
  navigate(qs ? `${path}?${qs}` : path, {
    replace: true,
    state: { fromPaymentReturn: true, ...extraState },
  });
}

/**
 * Poll Cashfree verify until paid, cancelled, hard failure, or timeout.
 * Use after GPay/UPI redirect — settlement often lags 15–90 seconds.
 */
export async function pollPaymentUntilVerified(
  apiBase,
  orderId,
  verifyOptions = {},
  { maxWaitMs = PAYMENT_POLL_MAX_WAIT_MS, onProgress = null } = {},
) {
  const started = Date.now();
  let attempt = 0;
  let lastResult = null;

  while (Date.now() - started < maxWaitMs) {
    attempt += 1;
    if (onProgress) {
      onProgress({ attempt, elapsedMs: Date.now() - started });
    }

    lastResult = await verifyPaymentWithRetry(apiBase, orderId, verifyOptions);

    if (lastResult.verified) return lastResult;
    if (lastResult.status === 'cancelled') return lastResult;
    if (lastResult.status === 'failed' && !lastResult.classified?.retryable) {
      return lastResult;
    }

    const delayIdx = Math.min(Math.max(attempt - 1, 0), PAYMENT_POLL_INTERVAL_MS.length - 1);
    const delay = PAYMENT_POLL_INTERVAL_MS[delayIdx] || 5000;
    if (Date.now() - started + delay >= maxWaitMs) break;
    await new Promise((r) => setTimeout(r, delay));
  }

  return lastResult || {
    ok: false,
    verified: false,
    status: 'pending',
    code: 'PAYMENT_PENDING',
    classified: classifyVerifyResponse({
      verified: false,
      status: 'pending',
      code: 'PAYMENT_PENDING',
      retryable: true,
    }),
  };
}
