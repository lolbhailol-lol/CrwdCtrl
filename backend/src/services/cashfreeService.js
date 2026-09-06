const axios = require('axios');
const crypto = require('crypto');

const API_VERSION = '2025-01-01';

/** @typedef {'platform' | 'events'} CashfreeMerchant */

/**
 * Platform = fests / run clubs / default.
 * Events = Delulu Athletes (listingHub=events) community bookings — separate Cashfree account.
 */
function normalizeMerchant(merchant) {
  return merchant === 'events' ? 'events' : 'platform';
}

function getCashfreeServerEnv(merchant = 'platform') {
  const m = normalizeMerchant(merchant);
  if (m === 'events') {
    const eventsEnv = String(process.env.CASHFREE_EVENTS_ENV || '').trim().toLowerCase();
    if (eventsEnv === 'production' || eventsEnv === 'sandbox') return eventsEnv;
  }
  return process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
}

/** Must match @cashfreepayments/cashfree-js `load({ mode })` on the frontend. */
const getCashfreeClientMode = (merchant = 'platform') => getCashfreeServerEnv(merchant);

const getBaseUrl = (merchant = 'platform') =>
  getCashfreeServerEnv(merchant) === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

function getMerchantCredentials(merchant = 'platform') {
  const m = normalizeMerchant(merchant);
  if (m === 'events') {
    const id = process.env.CASHFREE_EVENTS_CLIENT_ID?.trim();
    const secret = process.env.CASHFREE_EVENTS_CLIENT_SECRET?.trim();
    if (id && secret) return { clientId: id, clientSecret: secret, merchant: 'events' };
    // Fail closed for events — never silently charge the platform merchant.
    return { clientId: '', clientSecret: '', merchant: 'events' };
  }
  return {
    clientId: process.env.CASHFREE_CLIENT_ID?.trim() || '',
    clientSecret: process.env.CASHFREE_CLIENT_SECRET?.trim() || '',
    merchant: 'platform',
  };
}

const getHeaders = (merchant = 'platform') => {
  const { clientId, clientSecret } = getMerchantCredentials(merchant);
  return {
    'x-client-id': clientId,
    'x-client-secret': clientSecret,
    'x-api-version': API_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
};

function assertCredentials(merchant = 'platform') {
  const { clientId, clientSecret, merchant: m } = getMerchantCredentials(merchant);
  if (!clientId || !clientSecret) {
    const err = new Error(
      m === 'events'
        ? 'Cashfree events merchant credentials not configured (CASHFREE_EVENTS_CLIENT_ID / CASHFREE_EVENTS_CLIENT_SECRET)'
        : 'Cashfree credentials not configured',
    );
    err.code = 'CASHFREE_CREDENTIALS_MISSING';
    throw err;
  }
}

const getFrontendBaseUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const buildReturnUrl = (orderId) =>
  `${getFrontendBaseUrl()}/payment/return?order_id={order_id}`;

const generateOrderId = () => `order_${crypto.randomBytes(12).toString('hex')}`;

/** First real 10-digit phone from a list of raw values. Empty string if none. */
function firstValidCustomerPhone(values = []) {
  const list = Array.isArray(values) ? values : [values];
  for (const value of list) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length >= 10) {
      const phone = digits.slice(-10);
      if (phone !== '9999999999') return phone;
    }
  }
  return '';
}

const normalizePhone = (phone) => firstValidCustomerPhone([phone]) || '9999999999';

/** Cashfree allows at most 15 order_tags keys — sanitize and cap. */
function sanitizeCashfreeOrderTags(raw = {}, maxKeys = 15) {
  const out = {};
  const entries = Object.entries(raw || {});
  if (entries.length > maxKeys) {
    console.warn(`[cashfree] order_tags has ${entries.length} keys; truncating to ${maxKeys}`);
  }
  for (const [key, value] of entries) {
    if (Object.keys(out).length >= maxKeys) break;
    if (value === undefined || value === null) continue;
    const k = String(key || '').trim();
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(k)) continue;
    let str = String(value).trim().slice(0, 255);
    if (!str) continue;
    if (/^https?:\/\//i.test(str) && !/^https:\/\//i.test(str)) continue;
    str = str.replace(/[^\w\s.@+\-:/]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!str) continue;
    out[k] = str;
  }
  return out;
}

async function createCashfreeOrder({
  orderAmount,
  currency = 'INR',
  customerDetails = {},
  orderMeta = {},
  orderNote = '',
  orderTags = {},
  merchant = 'platform',
}) {
  const m = normalizeMerchant(merchant);
  assertCredentials(m);
  const orderId = generateOrderId();
  const payload = {
    order_id: orderId,
    order_amount: Number(orderAmount),
    order_currency: currency,
    customer_details: {
      customer_id: String(customerDetails.customerId || `guest_${Date.now()}`),
      customer_name: customerDetails.customerName || customerDetails.name || 'Customer',
      customer_email: customerDetails.customerEmail || customerDetails.email || 'customer@crwdctrl.com',
      customer_phone: normalizePhone(customerDetails.customerPhone || customerDetails.phone),
    },
    order_meta: {
      return_url: buildReturnUrl(orderId),
      ...orderMeta,
    },
    order_note: orderNote,
    order_tags: sanitizeCashfreeOrderTags(orderTags),
  };

  const response = await axios.post(`${getBaseUrl(m)}/orders`, payload, { headers: getHeaders(m) });
  return { ...response.data, cashfreeMerchant: m };
}

async function fetchOrder(orderId, { merchant = 'platform' } = {}) {
  const m = normalizeMerchant(merchant);
  const response = await axios.get(`${getBaseUrl(m)}/orders/${orderId}`, { headers: getHeaders(m) });
  return response.data;
}

async function fetchPaymentsForOrder(orderId, { merchant = 'platform' } = {}) {
  const m = normalizeMerchant(merchant);
  const response = await axios.get(`${getBaseUrl(m)}/orders/${orderId}/payments`, { headers: getHeaders(m) });
  return response.data;
}

async function fetchOrderSettlements(orderId, { merchant = 'platform' } = {}) {
  const m = normalizeMerchant(merchant);
  assertCredentials(m);
  try {
    const response = await axios.get(
      `${getBaseUrl(m)}/orders/${encodeURIComponent(orderId)}/settlements`,
      { headers: getHeaders(m) },
    );
    return { ok: true, status: response.status, data: response.data };
  } catch (err) {
    const status = err.response?.status || 0;
    if (status === 404) {
      return { ok: true, status: 404, data: null, missing: true };
    }
    return {
      ok: false,
      status,
      data: err.response?.data || null,
      error: err.message || 'Cashfree settlement fetch failed',
    };
  }
}

function mapOrderStatus(orderStatus) {
  const s = String(orderStatus || '').toUpperCase();
  if (s === 'PAID') return 'paid';
  if (['ACTIVE', 'PENDING', 'PENDING_VBV', 'PENDING_CAPTURE', 'FLAGGED'].includes(s)) return 'pending';
  if (['EXPIRED', 'CANCELLED', 'TERMINATED', 'USER_DROPPED'].includes(s)) return 'cancelled';
  if (s === 'FAILED') return 'failed';
  return 'pending';
}

function buildVerifyMessages(status, orderStatus) {
  switch (status) {
    case 'paid':
      return {
        code: 'PAYMENT_PAID',
        message: 'Payment confirmed.',
        retryable: false,
      };
    case 'pending':
      return {
        code: 'PAYMENT_PENDING',
        message: 'Payment is still processing. Please wait a moment and try again.',
        retryable: true,
      };
    case 'cancelled':
      return {
        code: 'PAYMENT_CANCELLED',
        message: 'Payment was cancelled. You can try again when ready.',
        retryable: false,
      };
    case 'failed':
      return {
        code: 'PAYMENT_FAILED',
        message: 'Payment failed. If money was deducted it will be refunded automatically.',
        retryable: false,
      };
    case 'not_found':
      return {
        code: 'ORDER_NOT_FOUND',
        message: 'Payment order not found.',
        retryable: false,
      };
    default:
      return {
        code: 'PAYMENT_UNKNOWN',
        message: `Order status is ${orderStatus || 'unknown'}`,
        retryable: true,
      };
  }
}

async function verifyCashfreePayment({ orderId, paymentId, merchant = 'platform' }) {
  const m = normalizeMerchant(merchant);
  let order;
  try {
    order = await fetchOrder(orderId, { merchant: m });
  } catch (err) {
    if (err.response?.status === 404) {
      const meta = buildVerifyMessages('not_found', null);
      return {
        verified: false,
        status: 'not_found',
        orderId,
        ...meta,
      };
    }
    throw err;
  }

  const orderStatus = order.order_status || 'pending';
  const status = mapOrderStatus(orderStatus);

  if (status !== 'paid') {
    const meta = buildVerifyMessages(status, orderStatus);
    return {
      verified: false,
      status,
      orderId,
      orderStatus,
      ...meta,
    };
  }

  const paymentsRaw = await fetchPaymentsForOrder(orderId, { merchant: m });
  const payments = Array.isArray(paymentsRaw) ? paymentsRaw : [];
  const customerPhone = firstValidCustomerPhone([
    order?.customer_details?.customer_phone,
    order?.customer_details?.customerPhone,
    ...payments.flatMap((p) => [
      p.customer_phone,
      p.customer_details?.customer_phone,
    ]),
  ]);

  if (paymentId) {
    const match = payments.find(
      (p) => String(p.cf_payment_id) === String(paymentId) && p.payment_status === 'SUCCESS',
    );
    if (!match) {
      return {
        verified: false,
        status: 'failed',
        orderId,
        paymentId: String(paymentId),
        orderStatus,
        code: 'PAYMENT_MISMATCH',
        message: 'Payment ID does not match a successful payment for this order.',
        retryable: false,
        customerPhone,
        cashfreeMerchant: m,
      };
    }
    return {
      verified: true,
      status: 'paid',
      code: 'PAYMENT_PAID',
      message: 'Payment confirmed.',
      retryable: false,
      orderId,
      paymentId: match.cf_payment_id,
      orderStatus,
      customerPhone,
      cashfreeMerchant: m,
    };
  }

  const successPayment = payments.find((p) => p.payment_status === 'SUCCESS');
  if (!successPayment) {
    // Order is PAID but payments list hasn't synced yet (common with UPI/GPay redirect).
    return {
      verified: true,
      status: 'paid',
      code: 'PAYMENT_PAID',
      message: 'Payment confirmed.',
      retryable: false,
      orderId,
      paymentId: paymentId || null,
      orderStatus,
      customerPhone,
      cashfreeMerchant: m,
    };
  }

  return {
    verified: true,
    status: 'paid',
    code: 'PAYMENT_PAID',
    message: 'Payment confirmed.',
    retryable: false,
    orderId,
    paymentId: successPayment.cf_payment_id,
    orderStatus,
    customerPhone,
    cashfreeMerchant: m,
  };
}

/**
 * Verify Cashfree webhook signature (HMAC-SHA256, base64).
 * Security: must use raw request body — parsed JSON will break signature match.
 * Cashfree signs with Client Secret (see official PG webhook docs).
 */
function getWebhookSecretCandidates() {
  // Cashfree signs webhooks with the PG Client Secret of the environment the
  // webhook is configured in. Try every configured secret so a single deploy can
  // validate both sandbox and production webhooks without a mode mismatch.
  return [
    process.env.CASHFREE_WEBHOOK_SECRET,
    process.env.CASHFREE_CLIENT_SECRET,
    process.env.CASHFREE_CLIENT_SECRET_PROD,
    process.env.CASHFREE_CLIENT_SECRET_SANDBOX,
    process.env.CASHFREE_EVENTS_WEBHOOK_SECRET,
    process.env.CASHFREE_EVENTS_CLIENT_SECRET,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    // de-dupe
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

function verifyWebhookSignature({ signature, timestamp, rawBody }) {
  const secrets = getWebhookSecretCandidates();

  if (secrets.length === 0) {
    const err = new Error(
      'Cashfree webhook secret not configured — set CASHFREE_CLIENT_SECRET or CASHFREE_WEBHOOK_SECRET'
    );
    err.code = 'WEBHOOK_SECRET_MISSING';
    throw err;
  }
  if (!signature || !timestamp || rawBody === undefined || rawBody === null) {
    return false;
  }

  const payload = String(timestamp) + rawBody;
  return secrets.some((secret) => {
    const computed = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    return computed === signature;
  });
}

/**
 * Detailed, non-secret-leaking diagnostics for webhook signature debugging.
 * Logs which candidate (by label + secret length) matched, and the received vs
 * computed signatures so a mismatch can be pinpointed. Never logs raw secrets.
 */
function inspectWebhookSignature({ signature, timestamp, rawBody }) {
  const labelled = [
    ['CASHFREE_WEBHOOK_SECRET', process.env.CASHFREE_WEBHOOK_SECRET],
    ['CASHFREE_CLIENT_SECRET', process.env.CASHFREE_CLIENT_SECRET],
    ['CASHFREE_CLIENT_SECRET_PROD', process.env.CASHFREE_CLIENT_SECRET_PROD],
    ['CASHFREE_CLIENT_SECRET_SANDBOX', process.env.CASHFREE_CLIENT_SECRET_SANDBOX],
    ['CASHFREE_EVENTS_WEBHOOK_SECRET', process.env.CASHFREE_EVENTS_WEBHOOK_SECRET],
    ['CASHFREE_EVENTS_CLIENT_SECRET', process.env.CASHFREE_EVENTS_CLIENT_SECRET],
  ]
    .map(([label, val]) => [label, val?.trim()])
    .filter(([, val]) => Boolean(val));

  const payload = String(timestamp) + rawBody;

  const candidates = labelled.map(([label, secret]) => {
    const computed = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    return {
      envVar: label,
      secretLen: secret.length,
      computed,
      matches: computed === signature,
    };
  });

  return {
    valid: candidates.some((c) => c.matches),
    hasSignature: !!signature,
    hasTimestamp: !!timestamp,
    receivedSignature: signature || null,
    timestamp: timestamp || null,
    bodyLength: rawBody?.length || 0,
    cashfreeEnv: process.env.CASHFREE_ENV || 'sandbox',
    candidates,
  };
}

module.exports = {
  createCashfreeOrder,
  fetchOrder,
  fetchPaymentsForOrder,
  fetchOrderSettlements,
  verifyCashfreePayment,
  verifyWebhookSignature,
  inspectWebhookSignature,
  generateOrderId,
  normalizePhone,
  firstValidCustomerPhone,
  sanitizeCashfreeOrderTags,
  getCashfreeClientMode,
  normalizeMerchant,
  getMerchantCredentials,
  mapOrderStatus,
};
