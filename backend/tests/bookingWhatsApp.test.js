const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveBookingPhone,
  buildBookingPathSuffix,
} = require('../src/utils/bookingWhatsApp');

test('resolveBookingPhone prefers user phone then form keys', () => {
  assert.equal(
    resolveBookingPhone({ user: { phoneNumber: '7276276424' } }),
    '917276276424'
  );
  assert.equal(
    resolveBookingPhone({ formData: { mobile: '9876543210' } }),
    '919876543210'
  );
  assert.equal(resolveBookingPhone({ formData: { emergency_phone: '9876543210' } }), null);
});

test('buildBookingPathSuffix includes type and access', () => {
  assert.equal(buildBookingPathSuffix({ bookingId: 'abc' }), 'abc');
  assert.equal(
    buildBookingPathSuffix({ bookingId: 'abc', type: 'trek' }),
    'abc?type=trek'
  );
  assert.match(
    buildBookingPathSuffix({ bookingId: 'abc', type: 'trek', accessToken: 'tok' }),
    /^abc\?type=trek&access=tok$/
  );
});
