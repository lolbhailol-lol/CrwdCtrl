import { load } from '@cashfreepayments/cashfree-js';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { prefersRedirectCheckout, isNativeApp } from './capacitorPlatform';
import { getApiBaseUrl } from '../config/apiBase';
import {
  openNativeCashfreeSdkCheckout,
  isNativeCashfreeAvailable,
} from './cashfreeNative';
import {
  storePendingPayment,
  getPendingPayment,
  clearPendingPayment,
  isTrekPaymentPending,
} from './deepLinks';

let cashfreeInstance = null;
let cashfreeMode = null;

const PUBLIC_WEB_URL = (
  import.meta.env.VITE_PUBLIC_WEB_URL || 'https://www.crwdctrl.in'
).replace(/\/$/, '');

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

function buildNativeCheckoutUrl({ paymentSessionId, orderId, returnPath }) {
  const qs = new URLSearchParams({
    payment_session_id: paymentSessionId,
  });
  if (orderId) qs.set('order_id', orderId);
  if (returnPath) qs.set('return_path', returnPath);
  return `${PUBLIC_WEB_URL}/payment/checkout?${qs.toString()}`;
}

/** Fallback: external browser on whitelisted crwdctrl.in domain. */
function waitForBrowserCheckoutComplete() {
  const apiBase = getApiBaseUrl();

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanups = [];

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      cleanups.forEach((fn) => fn());
      fn();
    };

    const tryVerify = async () => {
      const pending = getPendingPayment();
      if (!pending?.orderId) {
        finish(() => reject(new Error('Payment was not completed.')));
        return;
      }

      if (isTrekPaymentPending(pending)) {
        finish(() => resolve({ browserCheckout: true, trekDeferred: true }));
        return;
      }

      const token = localStorage.getItem('crwdctrl_token');
      const result = await verifyPendingCashfreePayment(apiBase, token);
      if (result?.verifyData?.verified) {
        finish(() =>
          resolve({
            browserCheckout: true,
            paymentDetails: { paymentId: result.verifyData.payment_id },
          }),
        );
        return;
      }

      finish(() => reject(new Error('Payment was not completed. Please try again.')));
    };

    Browser.addListener('browserFinished', () => {
      tryVerify().catch((err) => finish(() => reject(err)));
    }).then((h) => cleanups.push(() => h.remove()));

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) tryVerify().catch(() => {});
    }).then((h) => cleanups.push(() => h.remove()));

    setTimeout(
      () => finish(() => reject(new Error('Payment timed out. Please try again.'))),
      15 * 60 * 1000,
    );
  });
}

async function openBrowserCashfreeCheckout({ paymentSessionId, orderId, returnPath, entityType }) {
  storePendingPayment({
    orderId,
    paymentSessionId,
    returnPath: returnPath || window.location.pathname,
    entityType,
  });

  await Browser.open({
    url: buildNativeCheckoutUrl({ paymentSessionId, orderId, returnPath }),
    presentationStyle: 'popover',
  });

  return waitForBrowserCheckoutComplete();
}

async function openCapacitorCashfreeCheckout(opts) {
  try {
    return await openNativeCashfreeSdkCheckout(opts);
  } catch (nativeErr) {
    console.warn('[Cashfree] Native SDK unavailable, falling back to browser:', nativeErr.message);
    return openBrowserCashfreeCheckout(opts);
  }
}

/**
 * Opens Cashfree checkout — native SDK in Capacitor app, modal/redirect on web.
 */
export async function openCashfreeCheckout({
  paymentSessionId,
  orderId,
  returnPath,
  entityType,
}) {
  if (!paymentSessionId || typeof paymentSessionId !== 'string') {
    throw new Error('Payment session missing. Restart the payment and try again.');
  }

  if (isNativeApp()) {
    return openCapacitorCashfreeCheckout({
      paymentSessionId,
      orderId,
      returnPath,
      entityType,
    });
  }

  const mode = getCashfreeMode();
  const useRedirect = prefersRedirectCheckout();

  if (useRedirect) {
    storePendingPayment({
      orderId,
      paymentSessionId,
      returnPath: returnPath || window.location.pathname,
      entityType,
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
    const domainHint =
      mode === 'sandbox' ? ' Whitelist your domain in Cashfree sandbox dashboard.' : '';
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
  const pending = getPendingPayment();
  if (!pending?.orderId) return null;

  if (isTrekPaymentPending(pending)) {
    return null;
  }

  const res = await fetch(`${apiBase}/payment/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ orderId: pending.orderId }),
    credentials: 'include',
  });

  if (!res.ok) return null;
  const data = await res.json();
  clearPendingPayment();
  return { verifyData: data, meta: pending };
}

export { isNativeCashfreeAvailable };
