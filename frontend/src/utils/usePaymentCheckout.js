import { openCashfreeCheckout } from './useCashfree';
import { openRazorpayCheckout } from './useRazorpay';

/** Open the checkout selected by the backend order response. */
export async function openPaymentCheckout({
  gateway = 'cashfree',
  keyId,
  orderId,
  paymentSessionId,
  returnPath,
  entityType,
  cashfreeMode,
  customerEmail = '',
  customerPhone = '',
  customerName = '',
  displayName = 'Event registration',
  merchantName = 'CrwdCtrl',
  alreadyPaidAtGateway = false,
}) {
  if (alreadyPaidAtGateway) {
    return { redirectDeferred: false, recoveredPaidOrder: true, paymentDetails: {} };
  }

  if (gateway === 'razorpay') {
    const result = await openRazorpayCheckout({
      keyId,
      orderId,
      name: merchantName,
      description: displayName,
      prefill: {
        name: customerName,
        email: customerEmail,
        contact: customerPhone,
      },
    });
    return {
      redirectDeferred: false,
      paymentDetails: {
        paymentId: result.razorpay_payment_id,
        signature: result.razorpay_signature,
      },
    };
  }

  return openCashfreeCheckout({
    paymentSessionId,
    orderId,
    returnPath,
    entityType,
    cashfreeMode,
    customerEmail,
  });
}
