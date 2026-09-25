const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  verifyRazorpayPayment,
  toPaise,
  buildRazorpayReceipt,
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

test('Razorpay receipt includes a readable competition name and stays within 40 chars', () => {
  const receipt = buildRazorpayReceipt('Game of Innovation – Software Edition', 'competition');
  assert.match(receipt, /^Game_of_Innovation_Software/);
  assert.ok(receipt.length <= 40);
  assert.notEqual(
    buildRazorpayReceipt('Game of Innovation', 'competition'),
    buildRazorpayReceipt('Game of Innovation', 'competition'),
  );
});

test('Razorpay webhook signature verifies the exact raw request body', () => {
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_unit_secret';
  try {
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    assert.equal(verifyRazorpayWebhookSignature({ rawBody, signature }), true);
    assert.equal(
      verifyRazorpayWebhookSignature({ rawBody: Buffer.from('{}'), signature }),
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
  }
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
