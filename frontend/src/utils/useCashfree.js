import { load } from '@cashfreepayments/cashfree-js';
import { prefersRedirectCheckout, isNativeApp } from './capacitorPlatform';
import {
  openNativeCashfreeSdkCheckout,
  isNativeCashfreeAvailable,
} from './cashfreeNative';
import {
  getPendingPayment,
  clearPendingPayment,
  storePendingPayment,
  markPaymentReturnExpected,
  isTrekPaymentPending,
} from './deepLinks';

let cashfreeInstance = null;
let cashfreeMode = null;

function getCashfreeMode(override) {
  if (override === 'production' || override === 'sandbox') return override;
  return import.meta.env.VITE_CASHFREE_MODE || 'sandbox';
}

async function getCashfree(modeOverride) {
  const mode = getCashfreeMode(modeOverride);
  if (!cashfreeInstance || cashfreeMode !== mode) {
    cashfreeInstance = await load({ mode });
    cashfreeMode = mode;
  }
  return cashfreeInstance;
}

/** Native prod SDK fails on sideloaded APKs (Cashfree Integrity). Use in-app Web SDK instead. */
function shouldUseInAppWebSdkFallback(message = '') {
  const msg = message.toLowerCase();
  return (
    /not loaded|cap sync|reinstall the app|rebuild/i.test(message) ||
    /not a trusted source|trusted source|installer_package_not_approved/i.test(msg) ||
    /not_available|play store|playstore|app store|whitelisted app store/i.test(msg)
  );
}

/**
 * Cashfree JS modal inside the Capacitor WebView (https://localhost).
 * Whitelist https://localhost in Cashfree dashboard for production.
 */
async function openInAppWebSdkCheckout({ paymentSessionId, cashfreeMode }) {
  const cashfree = await getCashfree(cashfreeMode);
  if (!cashfree) {
    throw new Error('Cashfree SDK not loaded. Please refresh and try again.');
  }

  const result = await cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_modal',
  });

  if (result.error) {
    const hint =
      getCashfreeMode(cashfreeMode) === 'production'
        ? ' Whitelist https://localhost in Cashfree dashboard (Developers → Whitelisting).'
        : '';
    throw formatCashfreeCheckoutError(result.error.message, cashfreeMode, hint);
  }

  if (!result.paymentDetails) {
    throw new Error('Payment was not completed');
  }

  return {
    inAppWebCheckout: true,
    paymentDetails: result.paymentDetails,
  };
}

function formatCashfreeCheckoutError(message, cashfreeMode, suffix = '') {
  const msg = message || 'Payment cancelled';
  if (/payment_session_id/i.test(msg)) {
    return new Error(
      `${msg}. Cashfree mode mismatch: backend created a ${getCashfreeMode(cashfreeMode)} session — ensure backend CASHFREE_ENV matches.${suffix}`,
    );
  }
  return new Error(`${msg}${suffix}`);
}

async function openCapacitorCashfreeCheckout(opts) {
  const { cashfreeMode } = opts;
  // Production native SDK requires Play Store install (Cashfree Integrity).
  // Sideloaded APKs: in-app JS modal inside the WebView works without Play Store.
  if (getCashfreeMode(cashfreeMode) === 'production') {
    try {
      return await openInAppWebSdkCheckout(opts);
    } catch (webErr) {
      console.warn('[Cashfree] In-app web checkout failed, trying native SDK:', webErr.message);
      try {
        return await openNativeCashfreeSdkCheckout(opts);
      } catch (nativeErr) {
        throw webErr;
      }
    }
  }

  try {
    return await openNativeCashfreeSdkCheckout(opts);
  } catch (nativeErr) {
    const errMessage = nativeErr?.message || '';
    if (shouldUseInAppWebSdkFallback(errMessage)) {
      return openInAppWebSdkCheckout(opts);
    }
    throw nativeErr;
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
  cashfreeMode,
}) {
  if (!paymentSessionId || typeof paymentSessionId !== 'string') {
    throw new Error('Payment session missing. Restart the payment and try again.');
  }

  const resolvedMode = getCashfreeMode(cashfreeMode);

  if (isNativeApp()) {
    const resolvedReturnPath =
      returnPath ||
      (typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/');

    if (orderId) {
      storePendingPayment({
        orderId,
        paymentSessionId,
        returnPath: resolvedReturnPath,
        entityType,
      });
    }

    try {
      const result = await openCapacitorCashfreeCheckout({
        paymentSessionId,
        orderId,
        returnPath: resolvedReturnPath,
        entityType,
        cashfreeMode: resolvedMode,
      });
      clearPendingPayment();
      return result;
    } catch (nativeErr) {
      clearPendingPayment();
      throw nativeErr;
    }
  }

  const mode = resolvedMode;
  const useRedirect = prefersRedirectCheckout();
  const resolvedReturnPath =
    returnPath ||
    (typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '/');

  const cashfree = await getCashfree(resolvedMode);
  if (!cashfree) {
    throw new Error('Cashfree SDK not loaded. Please refresh the page and try again.');
  }

  if (useRedirect && orderId) {
    storePendingPayment({
      orderId,
      paymentSessionId,
      returnPath: resolvedReturnPath,
      entityType,
    });

    const result = await cashfree.checkout({
      paymentSessionId,
      redirectTarget: '_self',
    });

    if (result?.error) {
      clearPendingPayment();
      const domainHint =
        mode === 'sandbox' ? ' Whitelist your domain in Cashfree sandbox dashboard.' : '';
      throw formatCashfreeCheckoutError(result.error.message, mode, domainHint);
    }

    if (result?.paymentDetails) {
      clearPendingPayment();
      return result;
    }

    // Redirect checkout: page navigates away; TrekBookingPage / FestRegistration resume after return
    markPaymentReturnExpected();
    return { redirectDeferred: true };
  }

  const result = await cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_modal',
  });

  if (result.error) {
    const domainHint =
      mode === 'sandbox' ? ' Whitelist your domain in Cashfree sandbox dashboard.' : '';
    throw formatCashfreeCheckoutError(result.error.message, mode, domainHint);
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
