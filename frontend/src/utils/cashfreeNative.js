import {
  beginNativeCheckoutPromise,
  getNativeCashfreeGateway,
  initCashfreeNativeGateway,
  isNativeCashfreeGatewayReady,
} from './bootstrapCashfreeNative';

function getCashfreeEnvironment() {
  const mode = import.meta.env.VITE_CASHFREE_MODE || 'sandbox';
  return mode === 'production' ? 'PRODUCTION' : 'SANDBOX';
}

/** Android native SDK requires theme even though Cordova docs mark it optional. */
function buildWebCheckoutPayload({ paymentSessionId, orderId }) {
  return {
    theme: {
      navigationBarBackgroundColor: '#2563EB',
      navigationBarTextColor: '#FFFFFF',
    },
    session: {
      payment_session_id: paymentSessionId,
      orderID: orderId,
      environment: getCashfreeEnvironment(),
    },
  };
}

/**
 * In-app Cashfree checkout via official Android/iOS SDK (cordova-plugin-cashfree-pg).
 */
export async function openNativeCashfreeSdkCheckout({ paymentSessionId, orderId }) {
  if (!paymentSessionId || !orderId) {
    throw new Error('Payment session missing. Restart the payment and try again.');
  }

  const gateway = await getNativeCashfreeGateway();
  const checkoutPromise = beginNativeCheckoutPromise();

  gateway.doWebCheckoutPayment(buildWebCheckoutPayload({ paymentSessionId, orderId }));

  return checkoutPromise;
}

export function isNativeCashfreeAvailable() {
  return isNativeCashfreeGatewayReady();
}

export { initCashfreeNativeGateway };
