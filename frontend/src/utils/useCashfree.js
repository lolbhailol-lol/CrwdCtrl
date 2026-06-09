import { load } from '@cashfreepayments/cashfree-js';
import { prefersRedirectCheckout, isNativeApp } from './capacitorPlatform';
import { storePendingPayment, isTrekPaymentPending } from './deepLinks';

let cashfreeInstance = null;
let cashfreeMode = null;

function getCashfreeMode() {
  return import.meta.env.VITE_CASHFREE_MODE || 'sandbox';
}

async function getCashfree() {
  const mode = getCashfreeMode();
  if (!cashfreeInstance || cashfreeMode !== mode) {
    cashfreeInstance = await load({ mode });
    cashfreeMode = mode;
  }
  return cashfreeInstance;
}

/**
 * Opens Cashfree checkout — modal on desktop, full redirect on mobile / Capacitor.
 * @param {object} opts
 * @param {string} opts.paymentSessionId
 * @param {string} [opts.orderId] - For resume verification after redirect
 * @param {string} [opts.returnPath] - In-app path after payment
 */
export async function openCashfreeCheckout({ paymentSessionId, orderId, returnPath }) {
  if (!paymentSessionId || typeof paymentSessionId !== 'string') {
    throw new Error('Payment session missing. Restart the payment and try again.');
  }

  const mode = getCashfreeMode();
  const useRedirect = prefersRedirectCheckout();

  if (useRedirect) {
    storePendingPayment({
      orderId,
      paymentSessionId,
      returnPath: returnPath || window.location.pathname,
    });
  }

  const cashfree = await getCashfree();
  if (!cashfree) {
    throw new Error('Cashfree SDK not loaded. Please refresh the page and try again.');
  }

  const result = await cashfree.checkout({
    paymentSessionId,
    redirectTarget: useRedirect ? '_self' : '_modal',
  });

  if (result.error) {
    const msg = result.error.message || 'Payment cancelled';
    const domainHint = mode === 'sandbox'
      ? ' Whitelist your domain in Cashfree sandbox dashboard.'
      : isNativeApp()
        ? ' Ensure in.crwdctrl.app / crwdctrl.in is whitelisted in Cashfree.'
        : '';
    throw new Error(`${msg}.${domainHint}`);
  }

  if (!result.paymentDetails) {
    throw new Error('Payment was not completed');
  }

  return result;
}

export function buildVerifiedPaymentFields(verifyData, orderId) {
  return {
    payment_order_id: verifyData.payment_order_id || orderId,
    payment_id: verifyData.payment_id,
  };
}

/**
 * After redirect checkout, verify fest/competition orders with backend.
 * Trek orders use /payment/trek-verify and are resumed on TrekBookingPage.
 */
export async function verifyPendingCashfreePayment(apiBase, token) {
  const pending = sessionStorage.getItem('crwdctrl_pending_payment');
  if (!pending) return null;

  let meta;
  try {
    meta = JSON.parse(pending);
  } catch {
    return null;
  }

  if (!meta.orderId) return null;

  // Trek checkout is completed on TrekBookingPage (trek-verify + register)
  if (isTrekPaymentPending(meta)) {
    return null;
  }

  const res = await fetch(`${apiBase}/payment/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ orderId: meta.orderId }),
    credentials: 'include',
  });

  if (!res.ok) return null;
  const data = await res.json();
  sessionStorage.removeItem('crwdctrl_pending_payment');
  return { verifyData: data, meta };
}
