const test = require('node:test');
const assert = require('node:assert/strict');
const Registration = require('../src/model/registration_model');
const DeskEntry = require('../src/model/fest_day_assisted_registration_model');
const { _test } = require('../src/controllers/festDayAssistedController');

test('assisted registration fields stay isolated from the normal registration schema', () => {
  assert.equal(Registration.schema.path('deskSubmissionKey'), undefined);
  assert.equal(Registration.schema.path('deskPaymentToken'), undefined);
  assert.ok(DeskEntry.schema.path('submissionKey'));
  assert.ok(DeskEntry.schema.path('paymentToken'));
});

test('public payment state never exposes a ticket before verified paid status', () => {
  const pending = { _id: 'desk1', status: 'pending', paymentToken: 'token', responses: new Map([['full_name', 'Captain']]) };
  const result = _test.publicState(pending, { orderId: 'order1', status: 'PENDING', totalAmount: 103, paymentSessionId: 'session', createdAt: new Date() });
  assert.equal(result.status, 'pending');
  assert.equal(result.ticketQr, null);
  assert.equal(result.paymentSessionId, 'session');
});

test('assisted order becomes expired after the fixed thirty-minute window', () => {
  const pending = { _id: 'desk1', status: 'pending', paymentToken: 'token', responses: new Map() };
  const result = _test.publicState(pending, { orderId: 'order1', status: 'PENDING', totalAmount: 103, paymentSessionId: 'session', createdAt: new Date(Date.now() - _test.ORDER_TTL_MS - 1) });
  assert.equal(result.status, 'expired');
  assert.equal(result.paymentSessionId, null);
});

test('desk phone normalization requires the last ten digits', () => {
  assert.equal(_test.phoneDigits('+91 98765 43210'), '9876543210');
});

test('desk roster accepts teammate names without requiring teammate accounts or email', () => {
  assert.deepEqual(_test.normalizeMembers([{ name: 'Teammate One', email: '' }], 'Captain'), [
    { name: 'Teammate One', email: '', phone: '', college: '' },
  ]);
});
