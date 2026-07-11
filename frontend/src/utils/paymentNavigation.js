/** Shared post-payment navigation — keeps redirects fast and consistent */

export const BOOKING_REDIRECT_MS = 800;
export const PAYMENT_VERIFY_RETRY_MS = [600, 1000, 1500, 2000];

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

/**
 * Verify Cashfree payment with short retries (webhook / redirect lag).
 * @param {'fest'|'trek'|'sports'} kind
 */
export async function verifyPaymentWithRetry(apiBase, orderId, { token = null, kind = 'fest' } = {}) {
  const endpoint =
    kind === 'trek' ? `${apiBase}/payment/trek-verify`
    : kind === 'sports' ? `${apiBase}/payment/sports-verify`
    : `${apiBase}/payment/verify`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const maxAttempts = PAYMENT_VERIFY_RETRY_MS.length + 1;
  let last = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ payment_order_id: orderId }),
    });
    last = await res.json().catch(() => ({}));
    if (last?.verified) return { ok: true, data: last, response: res };
    const retryable = /pending|ACTIVE|not found|not successful/i.test(last?.message || '');
    if (!retryable || attempt === maxAttempts - 1) break;
    await new Promise((r) => setTimeout(r, PAYMENT_VERIFY_RETRY_MS[attempt] || 1500));
  }

  return { ok: false, data: last };
}
