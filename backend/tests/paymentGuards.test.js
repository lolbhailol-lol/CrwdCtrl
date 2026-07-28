const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeTransactionId,
  pendingCutoffDate,
  peopleFromRegistration,
  isAllowedPaymentScreenshotUrl,
} = require('../src/utils/runClubRegistrationGuards');
const {
  buildPriceBreakdown,
  buildTrekPriceBreakdown,
  parseTicketPrice,
  splitTrekOrganizerPayment,
} = require('../src/utils/platformFee');

test('normalizeTransactionId trims, uppercases and removes spaces', () => {
  assert.equal(normalizeTransactionId('  ab c 123  '), 'ABC123');
  assert.equal(normalizeTransactionId(null), '');
});

test('pendingCutoffDate returns a Date in the past', () => {
  const now = Date.now();
  const cutoff = pendingCutoffDate(2);
  assert.ok(cutoff instanceof Date);
  assert.ok(cutoff.getTime() <= now - (2 * 60 * 60 * 1000) + 2000);
});

test('peopleFromRegistration uses bookingPeople first, then responses', () => {
  assert.equal(peopleFromRegistration({ bookingPeople: 4, responses: { people: 1 } }), 4);
  assert.equal(peopleFromRegistration({ responses: { people: 3 } }), 3);
  assert.equal(peopleFromRegistration({ responses: { people: 'x' } }), 1);
});

test('isAllowedPaymentScreenshotUrl allows localhost in non-production and rejects invalid protocols', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCloud = process.env.CLOUDINARY_CLOUD_NAME;
  const originalHosts = process.env.PAYMENT_SCREENSHOT_ALLOWED_HOSTS;

  try {
    process.env.NODE_ENV = 'development';
    process.env.CLOUDINARY_CLOUD_NAME = 'crwdctrl';
    process.env.PAYMENT_SCREENSHOT_ALLOWED_HOSTS = 'images.example.com';

    assert.equal(isAllowedPaymentScreenshotUrl('http://localhost:8080/file.png'), true);
    assert.equal(
      isAllowedPaymentScreenshotUrl('https://res.cloudinary.com/crwdctrl/image/upload/test.png'),
      true,
    );
    assert.equal(
      isAllowedPaymentScreenshotUrl('https://res.cloudinary.com/other/image/upload/test.png'),
      false,
    );
    assert.equal(isAllowedPaymentScreenshotUrl('https://images.example.com/p.png'), true);
    assert.equal(isAllowedPaymentScreenshotUrl('javascript:alert(1)'), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CLOUDINARY_CLOUD_NAME = originalCloud;
    process.env.PAYMENT_SCREENSHOT_ALLOWED_HOSTS = originalHosts;
  }
});

test('price breakdown helpers keep fee arithmetic stable', () => {
  assert.deepEqual(buildPriceBreakdown(100), {
    ticketPrice: 100,
    platformFee: 3,
    totalAmount: 103,
  });

  assert.deepEqual(buildTrekPriceBreakdown(100, 0), {
    ticketPrice: 100,
    platformFee: 0,
    totalAmount: 100,
  });

  assert.equal(parseTicketPrice('150.50'), 150.5);
  assert.equal(parseTicketPrice('free'), 0);
});

test('splitTrekOrganizerPayment resolves organizer net and platform fee from paid total', () => {
  const split = splitTrekOrganizerPayment(206, 3, { registrationFeePerPerson: 100, people: 2 });
  assert.deepEqual(split, {
    organizerNet: 200,
    platformFee: 6,
    grossCollected: 206,
  });
});
