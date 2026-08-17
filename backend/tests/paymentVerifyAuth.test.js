const test = require('node:test');
const assert = require('node:assert/strict');

const { authorizePaymentVerify } = require('../src/utils/paymentVerifyAuth');

test('authorize allows verify when order has no user and no email captured', () => {
  const result = authorizePaymentVerify({
    paymentOrder: { userId: null, customerEmail: '' },
    req: { user: null, body: {} },
  });
  assert.equal(result.ok, true);
});

test('authorize rejects a user-owned order when the request has no matching JWT', () => {
  const result = authorizePaymentVerify({
    paymentOrder: { userId: 'user_a', customerEmail: 'a@example.com' },
    req: { user: null, body: {} },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.code, 'ORDER_OWNERSHIP_MISMATCH');
});

test('authorize rejects a user-owned order when the JWT belongs to a different user', () => {
  const result = authorizePaymentVerify({
    paymentOrder: { userId: 'user_a', customerEmail: '' },
    req: { user: { userId: 'user_b' }, body: {} },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('authorize allows a user-owned order when the JWT matches', () => {
  const result = authorizePaymentVerify({
    paymentOrder: { userId: 'user_a', customerEmail: '' },
    req: { user: { userId: 'user_a' }, body: {} },
  });
  assert.equal(result.ok, true);
});

test('authorize enforces email match for a guest order', () => {
  const paymentOrder = { userId: null, customerEmail: 'Guest@Example.com' };

  const missing = authorizePaymentVerify({
    paymentOrder,
    req: { user: null, body: {} },
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'ORDER_EMAIL_REQUIRED');

  const wrong = authorizePaymentVerify({
    paymentOrder,
    req: { user: null, body: { customerEmail: 'someone-else@example.com' } },
  });
  assert.equal(wrong.ok, false);

  const right = authorizePaymentVerify({
    paymentOrder,
    req: { user: null, body: { customerEmail: 'guest@example.com' } },
  });
  assert.equal(right.ok, true);
});

test('authorize returns ok when no PaymentOrder exists yet', () => {
  const result = authorizePaymentVerify({
    paymentOrder: null,
    req: { user: null, body: {} },
  });
  assert.equal(result.ok, true);
});
