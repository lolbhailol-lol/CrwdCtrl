import { load } from '@cashfreepayments/cashfree-js';

let cashfreeInstance = null;

async function getCashfree() {
  if (!cashfreeInstance) {
    cashfreeInstance = await load({
      mode: import.meta.env.VITE_CASHFREE_MODE || 'sandbox',
    });
  }
  return cashfreeInstance;
}

/**
 * Opens Cashfree checkout modal.
 * @param {object} opts
 * @param {string} opts.paymentSessionId - From backend create-order response
 * @returns {Promise<object>} Checkout result from Cashfree SDK
 */
export async function openCashfreeCheckout({ paymentSessionId }) {
  const cashfree = await getCashfree();
  if (!cashfree) {
    throw new Error('Cashfree SDK not loaded. Please refresh the page and try again.');
  }

  const result = await cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_modal',
  });

  if (result.error) {
    throw new Error(result.error.message || 'Payment cancelled');
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
