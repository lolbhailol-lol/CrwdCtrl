const test = require('node:test');
const assert = require('node:assert/strict');
const Registration = require('../src/model/registration_model');
const { _test } = require('../src/controllers/festDayAssistedController');

test('assisted registration schema carries idempotency and opaque payment fields', () => {
  assert.ok(Registration.schema.path('deskSubmissionKey'));
  assert.ok(Registration.schema.path('deskPaymentToken'));
  assert.ok(Registration.schema.path('deferTicketUntilPaid'));
});

test('public payment state never exposes a ticket before verified paid status', () => {
  const pending = { _id: 'reg1', status: 'pending', paymentStatus: 'pending', qrCodeData: 'secret-ticket', responses: new Map([['full_name', 'Captain']]) };
  const result = _test.publicState(pending, { orderId: 'order1', status: 'PENDING', totalAmount: 103, paymentSessionId: 'session', createdAt: new Date() });
  assert.equal(result.status, 'pending');
  assert.equal(result.ticketQr, null);
  assert.equal(result.paymentSessionId, 'session');
});

test('assisted order becomes expired after the fixed thirty-minute window', () => {
  const pending = { _id: 'reg1', status: 'pending', paymentStatus: 'pending', responses: new Map() };
  const result = _test.publicState(pending, { orderId: 'order1', status: 'PENDING', totalAmount: 103, paymentSessionId: 'session', createdAt: new Date(Date.now() - _test.ORDER_TTL_MS - 1) });
  assert.equal(result.status, 'expired');
  assert.equal(result.paymentSessionId, null);
});

test('desk phone normalization requires the last ten digits', () => {
  assert.equal(_test.phoneDigits('+91 98765 43210'), '9876543210');
});
