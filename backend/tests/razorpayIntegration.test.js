const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  verifyRazorpaySignature,
  verifyRazorpayPayment,
  toPaise,
} = require('../src/services/razorpayService');
const {
  normalizePaymentGateway,
  resolveCheckoutGateway,
} = require('../src/utils/paymentGatewayConfig');

test('gateway switches accept only known providers', () => {
  assert.equal(normalizePaymentGateway('razorpay'), 'razorpay');
  assert.equal(normalizePaymentGateway('CASHFREE'), 'cashfree');
  assert.equal(normalizePaymentGateway('unknown'), 'cashfree');
});

test('fest and Delulu gateway switches are independent', () => {
  const previousFest = process.env.FEST_PAYMENT_GATEWAY;
  const previousDelulu = process.env.DELULU_PAYMENT_GATEWAY;
  const previousRuns = process.env.RUNS_PAYMENT_GATEWAY;
  process.env.FEST_PAYMENT_GATEWAY = 'razorpay';
  process.env.DELULU_PAYMENT_GATEWAY = 'cashfree';
  process.env.RUNS_PAYMENT_GATEWAY = 'razorpay';
  try {
    assert.equal(resolveCheckoutGateway({ entityType: 'competition' }), 'razorpay');
    assert.equal(resolveCheckoutGateway({ entityType: 'event_show' }), 'cashfree');
    assert.equal(resolveCheckoutGateway({ entityType: 'sports', listingHub: 'events' }), 'cashfree');
    assert.equal(resolveCheckoutGateway({ entityType: 'sports', listingHub: 'sports' }), 'razorpay');
  } finally {
    if (previousFest === undefined) delete process.env.FEST_PAYMENT_GATEWAY;
    else process.env.FEST_PAYMENT_GATEWAY = previousFest;
    if (previousDelulu === undefined) delete process.env.DELULU_PAYMENT_GATEWAY;
    else process.env.DELULU_PAYMENT_GATEWAY = previousDelulu;
    if (previousRuns === undefined) delete process.env.RUNS_PAYMENT_GATEWAY;
    else process.env.RUNS_PAYMENT_GATEWAY = previousRuns;
  }
});

test('Razorpay signature verification accepts only the exact order and payment pair', () => {
  const previousId = process.env.RAZORPAY_KEY_ID;
  const previousSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
  process.env.RAZORPAY_KEY_SECRET = 'unit_secret';
  try {
    const orderId = 'order_unit_123';
    const paymentId = 'pay_unit_456';
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    assert.equal(verifyRazorpaySignature({ orderId, paymentId, signature }), true);
    assert.equal(verifyRazorpaySignature({ orderId, paymentId: 'pay_wrong', signature }), false);
    assert.equal(verifyRazorpaySignature({ orderId, paymentId, signature: '' }), false);
    assert.equal(toPaise(1), 100);
  } finally {
    if (previousId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previousId;
    if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = previousSecret;
  }
});

test('Razorpay verification rejects a partial success payload', async () => {
  const result = await verifyRazorpayPayment({
    orderId: 'order_unit_123',
    paymentId: 'pay_unit_456',
    signature: '',
  });
  assert.equal(result.verified, false);
  assert.equal(result.code, 'MISSING_PAYMENT_FIELDS');
  assert.equal(result.retryable, false);
});
