import { Capacitor } from '@capacitor/core';

function getCashfreeEnvironment() {
  const mode = import.meta.env.VITE_CASHFREE_MODE || 'sandbox';
  return mode === 'production' ? 'PRODUCTION' : 'SANDBOX';
}

function waitForCashfreeGateway(maxMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const tryResolve = () => {
      if (typeof window !== 'undefined' && window.CFPaymentGateway?.doWebCheckoutPayment) {
        resolve(window.CFPaymentGateway);
        return true;
      }
      return false;
    };

    if (!Capacitor.isNativePlatform()) {
      reject(new Error('Cashfree native SDK is only available in the mobile app.'));
      return;
    }

    if (tryResolve()) return;

    const poll = () => {
      if (tryResolve()) return;
      if (Date.now() - start >= maxMs) {
        reject(new Error('Cashfree native SDK not loaded. Rebuild the app with cap sync.'));
        return;
      }
      setTimeout(poll, 100);
    };

    document.addEventListener('deviceready', poll, { once: true });
    poll();
  });
}

/**
 * In-app Cashfree checkout via official Android/iOS SDK (cordova-plugin-cashfree-pg).
 */
export async function openNativeCashfreeSdkCheckout({ paymentSessionId, orderId }) {
  if (!paymentSessionId || !orderId) {
    throw new Error('Payment session missing. Restart the payment and try again.');
  }

  const gateway = await waitForCashfreeGateway();

  return new Promise((resolve, reject) => {
    gateway.setCallback({
      onVerify(result) {
        const verifiedOrderId =
          typeof result === 'string' ? result : result?.orderID || result?.orderId || orderId;
        resolve({
          nativeCheckout: true,
          paymentDetails: {
            orderId: verifiedOrderId,
            paymentId: result?.paymentId || result?.cf_payment_id || '',
          },
        });
      },
      onError(error) {
        const message =
          error?.message ||
          (typeof error === 'string' ? error : 'Payment failed or was cancelled');
        reject(new Error(message));
      },
    });

    gateway.doWebCheckoutPayment({
      session: {
        payment_session_id: paymentSessionId,
        orderID: orderId,
        environment: getCashfreeEnvironment(),
      },
    });
  });
}

export function isNativeCashfreeAvailable() {
  return typeof window !== 'undefined' && Boolean(window.CFPaymentGateway?.doWebCheckoutPayment);
}
