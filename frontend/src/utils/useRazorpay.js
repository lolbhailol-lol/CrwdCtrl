/**
 * Opens Razorpay standard checkout and resolves with the payment response
 * on success, or rejects with an Error on cancellation/failure.
 *
 * @param {object} opts
 * @param {string}  opts.orderId     - Razorpay order ID from backend
 * @param {string}  opts.currency    - e.g. "INR"
 * @param {string}  opts.name        - User's display name (prefill)
 * @param {string}  opts.email       - User's email (prefill)
 * @param {string}  [opts.contact]   - User's phone (prefill, optional)
 * @param {string}  [opts.description] - Payment description shown in modal
 * @returns {Promise<{razorpay_order_id, razorpay_payment_id, razorpay_signature}>}
 */
export function openRazorpayCheckout({ orderId, currency, name, email, contact = '', description = 'Competition Registration' }) {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay SDK not loaded. Please refresh the page and try again.'));
      return;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      currency,
      name: 'CrwdCtrl',
      description,
      order_id: orderId,
      prefill: { name, email, contact },
      theme: { color: '#0ECCEE' },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (response) => {
      reject(new Error(response.error?.description || 'Payment failed'));
    });
    rzp.open();
  });
}
