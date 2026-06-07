const axios = require('axios');
const crypto = require('crypto');

const API_VERSION = '2025-01-01';

const getBaseUrl = () =>
  process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

const getHeaders = () => ({
  'x-client-id': process.env.CASHFREE_CLIENT_ID,
  'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
  'x-api-version': API_VERSION,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

function assertCredentials() {
  if (!process.env.CASHFREE_CLIENT_ID?.trim() || !process.env.CASHFREE_CLIENT_SECRET?.trim()) {
    const err = new Error('Cashfree credentials not configured');
    err.code = 'CASHFREE_CREDENTIALS_MISSING';
    throw err;
  }
}

const generateOrderId = () => `order_${crypto.randomBytes(12).toString('hex')}`;

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
};

async function createCashfreeOrder({
  orderAmount,
  currency = 'INR',
  customerDetails = {},
  orderMeta = {},
  orderNote = '',
  orderTags = {},
}) {
  assertCredentials();
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
    order_meta: orderMeta,
    order_note: orderNote,
    order_tags: orderTags,
  };

  const response = await axios.post(`${getBaseUrl()}/orders`, payload, { headers: getHeaders() });
  return response.data;
}

async function fetchOrder(orderId) {
  const response = await axios.get(`${getBaseUrl()}/orders/${orderId}`, { headers: getHeaders() });
  return response.data;
}

async function fetchPaymentsForOrder(orderId) {
  const response = await axios.get(`${getBaseUrl()}/orders/${orderId}/payments`, { headers: getHeaders() });
  return response.data;
}

async function verifyCashfreePayment({ orderId, paymentId }) {
  const order = await fetchOrder(orderId);

  if (order.order_status !== 'PAID') {
    return { verified: false, message: `Order status is ${order.order_status || 'pending'}` };
  }

  const paymentsRaw = await fetchPaymentsForOrder(orderId);
  const payments = Array.isArray(paymentsRaw) ? paymentsRaw : [];

  if (paymentId) {
    const match = payments.find(
      (p) => String(p.cf_payment_id) === String(paymentId) && p.payment_status === 'SUCCESS'
    );
    if (!match) {
      return { verified: false, message: 'Payment ID not found or not successful' };
    }
    return { verified: true, orderId, paymentId: match.cf_payment_id, orderStatus: order.order_status };
  }

  const successPayment = payments.find((p) => p.payment_status === 'SUCCESS');
  if (!successPayment) {
    return { verified: false, message: 'No successful payment found for this order' };
  }

  return {
    verified: true,
    orderId,
    paymentId: successPayment.cf_payment_id,
    orderStatus: order.order_status,
  };
}

module.exports = {
  createCashfreeOrder,
  fetchOrder,
  fetchPaymentsForOrder,
  verifyCashfreePayment,
  generateOrderId,
  normalizePhone,
};
