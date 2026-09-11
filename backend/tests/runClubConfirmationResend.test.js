const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldSkipConfirmationResend } = require('../src/utils/runClubParticipantOutreach');

test('does not skip when payment was just linked (different order id)', () => {
  const reg = {
    payment_order_id: 'order_old',
    confirmationEmailSentAt: new Date(),
    updatedAt: new Date(),
  };
  assert.equal(
    shouldSkipConfirmationResend(reg, { incomingPaymentOrderId: 'order_new' }),
    false,
  );
});

test('does not skip when registration was recently updated but no email was sent', () => {
  const reg = {
    payment_order_id: 'order_1',
    updatedAt: new Date(),
    confirmationEmailSentAt: null,
  };
  assert.equal(
    shouldSkipConfirmationResend(reg, { incomingPaymentOrderId: 'order_1' }),
    false,
  );
});

test('skips duplicate resend when confirmation email was sent recently for same order', () => {
  const reg = {
    payment_order_id: 'order_1',
    confirmationEmailSentAt: new Date(),
    updatedAt: new Date(),
  };
  assert.equal(
    shouldSkipConfirmationResend(reg, { incomingPaymentOrderId: 'order_1' }),
    true,
  );
});

test('does not skip when last confirmation email is older than the window', () => {
  const reg = {
    payment_order_id: 'order_1',
    confirmationEmailSentAt: new Date(Date.now() - 120_000),
  };
  assert.equal(
    shouldSkipConfirmationResend(reg, { incomingPaymentOrderId: 'order_1' }),
    false,
  );
});
