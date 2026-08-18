import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyVerifyError,
  classifyVerifyResponse,
  classifyCheckoutError,
} from '../src/utils/paymentClassify.js';

test('cancelled verify does not look like paid or pending', () => {
  const classified = classifyVerifyResponse({
    verified: false,
    status: 'cancelled',
    code: 'PAYMENT_CANCELLED',
    message: 'Payment was cancelled. You can try again when ready.',
  });
  assert.equal(classified.verified, false);
  assert.equal(classified.status, 'cancelled');

  const err = classifyVerifyError({
    status: 'cancelled',
    code: 'PAYMENT_CANCELLED',
    classified,
  });
  assert.equal(err.kind, 'cancelled');
  assert.match(err.message, /cancelled/i);
});

test('checkout user-closed is classified as cancelled, not failed', () => {
  const err = classifyCheckoutError(new Error('User closed the payment popup'));
  assert.equal(err.kind, 'cancelled');
});

test('pending verify stays retryable', () => {
  const classified = classifyVerifyResponse({
    verified: false,
    status: 'pending',
    code: 'PAYMENT_PENDING',
    retryable: true,
  });
  assert.equal(classified.retryable, true);
  assert.equal(classifyVerifyError(classified).kind, 'pending');
});
