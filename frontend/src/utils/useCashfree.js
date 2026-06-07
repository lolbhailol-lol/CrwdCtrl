import { load } from '@cashfreepayments/cashfree-js';

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
 * Opens Cashfree checkout modal.
 * @param {object} opts
 * @param {string} opts.paymentSessionId - From backend create-order response
 * @returns {Promise<object>} Checkout result from Cashfree SDK
 */
export async function openCashfreeCheckout({ paymentSessionId }) {
  if (!paymentSessionId || typeof paymentSessionId !== 'string') {
    throw new Error('Payment session missing. Restart the payment and try again.');
  }

  const mode = getCashfreeMode();
  if (import.meta.env.DEV) {
    console.info('[Cashfree] Opening checkout', { mode, sessionPrefix: paymentSessionId.slice(0, 12) });
  }

  const cashfree = await getCashfree();
  if (!cashfree) {
    throw new Error('Cashfree SDK not loaded. Please refresh the page and try again.');
  }

  const result = await cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_modal',
  });

  if (result.error) {
    const msg = result.error.message || 'Payment cancelled';
    const domainHint =
      mode === 'sandbox'
        ? ' Add http://localhost:5173 under Developers → Domain Whitelisting in the Cashfree sandbox dashboard.'
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
