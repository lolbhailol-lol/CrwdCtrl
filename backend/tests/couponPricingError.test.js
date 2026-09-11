const test = require('node:test');
const assert = require('node:assert/strict');

const { couponValidationError } = require('../src/utils/couponPricing');

test('coupon validation errors are client errors, not payment server failures', () => {
  const error = couponValidationError(
    'You have already used this coupon the maximum allowed times.',
    'COUPON_USER_LIMIT',
  );

  assert.equal(error.status, 400);
  assert.equal(error.code, 'COUPON_USER_LIMIT');
  assert.equal(error.message, 'You have already used this coupon the maximum allowed times.');
});
