const test = require('node:test');
const assert = require('node:assert/strict');

const { validateStoredPaymentOrder } = require('../src/utils/paymentVerification');

const paidOrder = {
  userId: 'user-1',
  entityType: 'competition',
  entityId: 'competition-1',
  totalAmount: 206,
  status: 'PAID',
};

test('paid order is bound to the expected user, entity, and amount', () => {
  assert.deepEqual(validateStoredPaymentOrder(paidOrder, {
    userId: 'user-1',
    entityType: 'competition',
    entityId: 'competition-1',
    expectedTotalAmount: 206,
  }), { ok: true });
});

test('rejects a paid order belonging to another user', () => {
  assert.match(validateStoredPaymentOrder(paidOrder, {
    userId: 'user-2',
  }).error, /does not belong/i);
});

test('rejects a paid order for another event or amount', () => {
  assert.match(validateStoredPaymentOrder(paidOrder, {
    entityType: 'fest',
    entityId: 'fest-1',
  }).error, /does not match/i);
  assert.match(validateStoredPaymentOrder(paidOrder, {
    expectedTotalAmount: 999,
  }).error, /amount/i);
});
