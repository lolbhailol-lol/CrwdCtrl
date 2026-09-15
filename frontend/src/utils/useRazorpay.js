/**
 * Razorpay Checkout.js helper for trek bookings (organizer merchant account).
 * Mirrors Cashfree reliability: script load races, modal dismiss races, clean errors.
 */

import { classifyCheckoutError } from './paymentClassify';

let razorpayScriptPromise = null;

function loadRazorpayScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout is only available in the browser'));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const fail = (message) => {
      razorpayScriptPromise = null;
      reject(new Error(message));
    };

    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      if (window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }
      existing.addEventListener('load', () => {
        if (window.Razorpay) resolve(window.Razorpay);
        else fail('Razorpay SDK failed to load');
      });
      existing.addEventListener('error', () => {
        fail('Could not load Razorpay checkout. Check your network and try again.');
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = '1';
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else fail('Razorpay SDK failed to load');
    };
    script.onerror = () => {
      fail('Could not load Razorpay checkout. Check your network and try again.');
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

/** Razorpay contact must be digits; prefer last 10 for IN numbers. Empty if unusable. */
export function sanitizeRazorpayContact(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '';
}

/**
 * Open Razorpay checkout for a server-created order.
 * When `order_id` is set, amount/currency come from the Razorpay order (avoids mismatch errors).
 * Prefill + hidden contact/email so Checkout skips the "Contact details" screen.
 * @returns {Promise<{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }>}
 */
export async function openRazorpayCheckout({
  keyId,
  orderId,
  name = 'CrwdCtrl',
  description = 'Trek booking',
  prefill = {},
  themeColor = '#0ECCEE',
}) {
  if (!keyId) {
    throw new Error(
      'Razorpay key is missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the backend, then restart.',
    );
  }
  if (!orderId) throw new Error('Razorpay order ID is missing.');

  const Razorpay = await loadRazorpayScript();
  // Razorpay REQUIRES a valid contact to skip the contact-details step.
  // Without it, Checkout always shows "Enter mobile number to continue".
  const contact = sanitizeRazorpayContact(prefill.contact);
  const email = String(prefill.email || '').trim().slice(0, 120);
  const customerName = String(prefill.name || '').trim().slice(0, 120);

  if (!contact) {
    throw new Error('Enter a valid 10-digit mobile number on the booking form, then try payment again.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email on the booking form, then try payment again.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let paymentSucceeded = false;
    let paymentFailedError = null;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    const options = {
      key: keyId,
      name,
      description: String(description || 'Trek booking').slice(0, 255),
      order_id: orderId,
      // Always prefill — required for Razorpay to skip contact screen
      prefill: {
        name: customerName || 'Guest',
        email,
        contact,
      },
      // Hide contact/email UI; values come from prefill above
      hidden: {
        contact: true,
        email: true,
      },
      readonly: {
        contact: true,
        email: true,
        name: true,
      },
      theme: { color: themeColor },
      retry: { enabled: true, max_count: 2 },
      remember_customer: false,
      handler(response) {
        paymentSucceeded = true;
        if (!response?.razorpay_payment_id || !response?.razorpay_signature) {
          finish(
            reject,
            new Error('Payment completed but confirmation details were incomplete. Please wait a moment and check My Bookings — do not pay again.'),
          );
          return;
        }
        finish(resolve, {
          razorpay_order_id: response.razorpay_order_id || orderId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      modal: {
        // Razorpay often fires ondismiss after success/failure — delay so handler wins the race.
        ondismiss() {
          window.setTimeout(() => {
            if (settled || paymentSucceeded) return;
            if (paymentFailedError) {
              finish(reject, paymentFailedError);
              return;
            }
            finish(reject, Object.assign(new Error('Payment cancelled'), { cancelled: true }));
          }, 500);
        },
        confirm_close: true,
        escape: true,
      },
    };

    try {
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', (response) => {
        const desc =
          response?.error?.description
          || response?.error?.reason
          || response?.error?.metadata?.error_description
          || 'Payment failed';
        const code = response?.error?.code || '';
        const err = new Error(code ? `${desc} (${code})` : desc);
        err.razorpay = response?.error || null;
        paymentFailedError = err;
        // Let modal close; ondismiss will settle with this error if handler did not.
        // Also settle soon so UI is not stuck if modal never dismisses.
        window.setTimeout(() => {
          if (!settled && !paymentSucceeded) finish(reject, err);
        }, 600);
      });
      rzp.open();
    } catch (err) {
      finish(reject, err instanceof Error ? err : new Error('Could not open Razorpay checkout'));
    }
  });
}

/**
 * Razorpay modal → verify with backend (same status shape as Cashfree helper).
 */
export async function runRazorpayCheckoutAndVerify({
  order,
  verifyOrder,
  prefill = {},
  displayName = 'Trek booking',
  merchantName = 'TrekkVede',
}) {
  if (!order?.orderId) {
    return { status: 'checkout_error', message: 'Missing Razorpay order from server.' };
  }
  if (!order?.keyId) {
    return {
      status: 'checkout_error',
      message:
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the backend, then restart.',
    };
  }

  let checkout;
  try {
    checkout = await openRazorpayCheckout({
      keyId: order.keyId,
      orderId: order.orderId,
      name: merchantName || 'TrekkVede',
      description: displayName,
      prefill,
    });
  } catch (err) {
    if (err?.cancelled) {
      return { status: 'cancelled', message: '' };
    }
    const { kind, message } = classifyCheckoutError(err);
    return {
      status: kind === 'cancelled' ? 'cancelled' : 'checkout_error',
      message: message || err?.message || 'Razorpay checkout failed',
    };
  }

  try {
    const verification = await verifyOrder({
      orderId: checkout.razorpay_order_id || order.orderId,
      paymentId: checkout.razorpay_payment_id,
      signature: checkout.razorpay_signature,
    });

    const verifiedPayload = verification?.data || verification;
    if (verification?.ok && verifiedPayload?.verified) {
      return {
        status: 'verified',
        verified: {
          payment_order_id:
            verifiedPayload.payment_order_id || checkout.razorpay_order_id || order.orderId,
          payment_id: verifiedPayload.payment_id || checkout.razorpay_payment_id,
          razorpay_signature: checkout.razorpay_signature,
        },
        checkoutPaymentId: checkout.razorpay_payment_id,
        signature: checkout.razorpay_signature,
      };
    }

    const classified = verification?.classified;
    return {
      status: 'verify_failed',
      message:
        classified?.message
        || verifiedPayload?.message
        || 'Payment verification failed. If money was deducted, check My Bookings — do not pay again.',
      checkout,
      verification,
    };
  } catch (err) {
    return {
      status: 'verify_failed',
      message:
        err?.message
        || 'We could not confirm your payment. Check My Bookings before trying again.',
      checkout,
    };
  }
}
