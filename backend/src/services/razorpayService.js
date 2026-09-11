const axios = require('axios');
const crypto = require('crypto');

const RAZORPAY_API = 'https://api.razorpay.com/v1';

function getRazorpayKeyId() {
  return String(process.env.RAZORPAY_KEY_ID || '').trim();
}

function getRazorpayKeySecret() {
  return String(process.env.RAZORPAY_KEY_SECRET || '').trim();
}

function assertCredentials() {
  if (!getRazorpayKeyId() || !getRazorpayKeySecret()) {
    const err = new Error('Razorpay credentials not configured');
    err.code = 'RAZORPAY_CREDENTIALS_MISSING';
    throw err;
  }
}

function getAuthHeader() {
  assertCredentials();
  const token = Buffer.from(`${getRazorpayKeyId()}:${getRazorpayKeySecret()}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/** INR rupees → paise (Razorpay amounts are integers in the smallest currency unit). */
function toPaise(amountRupees) {
  return Math.round(Number(amountRupees) * 100);
}

/**
 * Create a Razorpay order for trek checkout (organizer merchant account).
 * @returns {{ order_id: string, amount: number, currency: string, amount_rupees: number }}
 */
async function createRazorpayOrder({
  orderAmount,
  currency = 'INR',
  receipt,
  notes = {},
}) {
  assertCredentials();
  const amountPaise = toPaise(orderAmount);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    const err = new Error('Order amount must be at least ₹1');
    err.code = 'RAZORPAY_INVALID_AMOUNT';
    throw err;
  }

  const safeNotes = {};
  for (const [key, value] of Object.entries(notes || {})) {
    if (value === undefined || value === null) continue;
    const k = String(key).trim().slice(0, 15);
    if (!k) continue;
    safeNotes[k] = String(value).slice(0, 256);
  }

  const { data } = await axios.post(
    `${RAZORPAY_API}/orders`,
    {
      amount: amountPaise,
      currency: String(currency || 'INR').toUpperCase(),
      receipt: String(receipt || `trek_${Date.now()}`).slice(0, 40),
      notes: safeNotes,
    },
    { headers: getAuthHeader(), timeout: 20000 },
  );

  return {
    order_id: data.id,
    amount: data.amount,
    currency: data.currency,
    amount_rupees: Number(orderAmount),
    status: data.status,
  };
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  assertCredentials();
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', getRazorpayKeySecret())
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(String(signature), 'utf8'),
    );
  } catch {
    return false;
  }
}

async function fetchRazorpayOrder(orderId) {
  assertCredentials();
  const { data } = await axios.get(`${RAZORPAY_API}/orders/${encodeURIComponent(orderId)}`, {
    headers: getAuthHeader(),
    timeout: 15000,
  });
  return data;
}

async function fetchRazorpayPayment(paymentId) {
  assertCredentials();
  const { data } = await axios.get(`${RAZORPAY_API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: getAuthHeader(),
    timeout: 15000,
  });
  return data;
}

async function fetchRazorpayOrderPayments(orderId) {
  assertCredentials();
  const { data } = await axios.get(
    `${RAZORPAY_API}/orders/${encodeURIComponent(orderId)}/payments`,
    { headers: getAuthHeader(), timeout: 15000 },
  );
  return Array.isArray(data?.items) ? data.items : [];
}

function isRazorpayPaymentSuccessful(payment) {
  const status = String(payment?.status || '').toLowerCase();
  return status === 'captured' || status === 'authorized';
}

/**
 * Verify trek payment via signature (preferred), payment fetch, or order payments
 * list (already-paid recovery when the client lost paymentId/signature).
 */
async function verifyRazorpayPayment({ orderId, paymentId, signature }) {
  if (!orderId) {
    return {
      verified: false,
      status: 'failed',
      code: 'MISSING_ORDER_ID',
      message: 'Missing order ID',
      retryable: false,
      orderId,
    };
  }

  if (signature && paymentId) {
    const ok = verifyRazorpaySignature({ orderId, paymentId, signature });
    if (!ok) {
      return {
        verified: false,
        status: 'failed',
        code: 'INVALID_SIGNATURE',
        message: 'Payment signature verification failed',
        retryable: false,
        orderId,
        paymentId,
      };
    }
    return {
      verified: true,
      status: 'paid',
      code: 'PAYMENT_PAID',
      message: 'Payment confirmed.',
      retryable: false,
      orderId,
      paymentId: String(paymentId),
    };
  }

  try {
    if (paymentId) {
      const payment = await fetchRazorpayPayment(paymentId);
      const paid = isRazorpayPaymentSuccessful(payment);
      const orderMatch = String(payment?.order_id || '') === String(orderId);
      if (!paid || !orderMatch) {
        return {
          verified: false,
          status: paid ? 'failed' : (payment?.status === 'failed' ? 'failed' : 'pending'),
          code: paid ? 'ORDER_MISMATCH' : 'PAYMENT_PENDING',
          message: paid
            ? 'Payment does not match this order'
            : 'Payment not completed yet',
          retryable: !paid && payment?.status !== 'failed',
          orderId,
          paymentId: String(paymentId),
        };
      }
      return {
        verified: true,
        status: 'paid',
        code: 'PAYMENT_PAID',
        message: 'Payment confirmed.',
        retryable: false,
        orderId,
        paymentId: String(paymentId),
      };
    }

    // No paymentId/signature (e.g. retry after pay succeeded but client lost handler payload):
    // confirm via order status + successful payments on that order.
    const rzOrder = await fetchRazorpayOrder(orderId);
    const orderStatus = String(rzOrder?.status || '').toLowerCase();
    if (orderStatus !== 'paid') {
      return {
        verified: false,
        status: orderStatus === 'attempted' ? 'pending' : (orderStatus === 'failed' ? 'failed' : 'pending'),
        code: orderStatus === 'failed' ? 'PAYMENT_FAILED' : 'PAYMENT_PENDING',
        message: orderStatus === 'failed' ? 'Payment failed.' : 'Payment not completed yet',
        retryable: orderStatus !== 'failed',
        orderId,
      };
    }
    const payments = await fetchRazorpayOrderPayments(orderId);
    const successful = payments.find(isRazorpayPaymentSuccessful);
    if (!successful?.id) {
      return {
        verified: false,
        status: 'pending',
        code: 'PAYMENT_PENDING',
        message: 'Payment not completed yet',
        retryable: true,
        orderId,
      };
    }
    return {
      verified: true,
      status: 'paid',
      code: 'PAYMENT_PAID',
      message: 'Payment confirmed.',
      retryable: false,
      orderId,
      paymentId: String(successful.id),
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        verified: false,
        status: 'not_found',
        code: 'ORDER_NOT_FOUND',
        message: 'Payment not found.',
        retryable: false,
        orderId,
        paymentId: paymentId || null,
      };
    }
    // Transient Razorpay API / network errors — let the client retry verify
    return {
      verified: false,
      status: 'pending',
      code: 'NETWORK_ERROR',
      message: 'Could not reach Razorpay to confirm payment. Retrying…',
      retryable: true,
      orderId,
      paymentId: paymentId ? String(paymentId) : null,
    };
  }
}

module.exports = {
  getRazorpayKeyId,
  getRazorpayKeySecret,
  createRazorpayOrder,
  verifyRazorpayPayment,
  verifyRazorpaySignature,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  toPaise,
};
