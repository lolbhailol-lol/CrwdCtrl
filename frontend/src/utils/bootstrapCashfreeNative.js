import { Capacitor } from '@capacitor/core';

let gatewayPromise = null;
let callbackRegistered = false;

/** @type {{ resolve: Function | null, reject: Function | null }} */
const pendingCheckout = { resolve: null, reject: null };

function waitForDeviceReady(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    if (window.CFPaymentGateway?.doWebCheckoutPayment) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    document.addEventListener('deviceready', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

function resolveGatewayFromWindow() {
  if (typeof window === 'undefined') return null;

  if (window.CFPaymentGateway?.doWebCheckoutPayment) {
    return window.CFPaymentGateway;
  }

  if (typeof window.cordova?.require === 'function') {
    try {
      const gateway = window.cordova.require('cordova-plugin-cashfree-pg.CFPaymentGateway');
      if (gateway?.doWebCheckoutPayment) {
        window.CFPaymentGateway = gateway;
        return gateway;
      }
    } catch {
      // Cordova module not registered yet.
    }
  }

  return null;
}

function registerGatewayCallbacks(gateway) {
  if (callbackRegistered || !gateway?.setCallback) return;
  callbackRegistered = true;

  gateway.setCallback({
    onVerify(result) {
      const orderId =
        typeof result === 'string'
          ? result
          : result?.orderID || result?.orderId || result?.order_id || '';
      pendingCheckout.resolve?.({
        nativeCheckout: true,
        paymentDetails: {
          orderId,
          paymentId: result?.paymentId || result?.cf_payment_id || '',
        },
      });
      pendingCheckout.resolve = null;
      pendingCheckout.reject = null;
    },
    onError(error) {
      const message =
        error?.message ||
        (typeof error === 'string' ? error : 'Payment failed or was cancelled');
      pendingCheckout.reject?.(new Error(message));
      pendingCheckout.resolve = null;
      pendingCheckout.reject = null;
    },
  });
}

/**
 * Preload Cordova Cashfree gateway on native app boot (after cap sync + rebuild).
 */
export function initCashfreeNativeGateway() {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve(null);
  }

  if (!gatewayPromise) {
    gatewayPromise = (async () => {
      await waitForDeviceReady();
      const deadline = Date.now() + 15000;

      while (Date.now() < deadline) {
        const gateway = resolveGatewayFromWindow();
        if (gateway) {
          registerGatewayCallbacks(gateway);
          return gateway;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      return null;
    })();
  }

  return gatewayPromise;
}

export async function getNativeCashfreeGateway() {
  const gateway = await initCashfreeNativeGateway();
  if (!gateway) {
    throw new Error(
      'Cashfree native SDK not loaded. Run npm run android:prod, rebuild in Android Studio, and reinstall the app.',
    );
  }
  return gateway;
}

export function beginNativeCheckoutPromise() {
  return new Promise((resolve, reject) => {
    pendingCheckout.resolve = resolve;
    pendingCheckout.reject = reject;
  });
}

export function isNativeCashfreeGatewayReady() {
  return Boolean(resolveGatewayFromWindow());
}
