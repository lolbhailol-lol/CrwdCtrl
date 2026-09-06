const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizePublicTrek,
  sanitizePublicSportsEvent,
  sanitizePublicFest,
  sanitizePublicCompetition,
  sanitizePublicRunClub,
  sanitizePublicEventShow,
  sanitizePublicPlatformEvent,
} = require('../src/utils/publicEntitySanitize');

test('sanitizePublicTrek removes secrets and keeps booking fields', () => {
  const result = sanitizePublicTrek({
    groupLink: 'https://wa.me/secret',
    scannerAccess: { passwordHash: 'hash' },
    createdBy: 'admin',
    registration: {
      organizerEmail: 'org@example.com',
      googleSheetsUrl: 'https://sheets.google.com',
      confirmationEmail: 'confirm@example.com',
      paymentQR: 'https://cdn/qr.png',
      paymentUpiId: 'upi@pay',
      formSchema: [{ key: 'name' }],
    },
    communityId: { name: 'Community', groupLink: 'https://wa.me/community' },
  });

  assert.equal(result.groupLink, undefined);
  assert.equal(result.scannerAccess, undefined);
  assert.equal(result.createdBy, undefined);
  assert.equal(result.registration.organizerEmail, undefined);
  assert.equal(result.registration.googleSheetsUrl, undefined);
  assert.equal(result.registration.confirmationEmail, undefined);
  assert.equal(result.communityId.groupLink, undefined);
  assert.equal(result.registration.paymentQR, 'https://cdn/qr.png');
  assert.equal(result.registration.paymentUpiId, 'upi@pay');
  assert.deepEqual(result.registration.formSchema, [{ key: 'name' }]);
});

test('sanitizePublicSportsEvent strips group links and scannerAccess', () => {
  const result = sanitizePublicSportsEvent({
    groupLink: 'https://wa.me/run',
    scannerAccess: { passwordHash: 'x' },
    registration: { organizerEmail: 'a@b.com', googleSheetsUrl: 'sheet', paymentQR: 'qr' },
    runClub: { name: 'Run Club', groupLink: 'https://wa.me/club' },
  });

  assert.equal(result.groupLink, undefined);
  assert.equal(result.scannerAccess, undefined);
  assert.equal(result.registration.organizerEmail, undefined);
  assert.equal(result.registration.googleSheetsUrl, undefined);
  assert.equal(result.runClub.groupLink, undefined);
  assert.equal(result.registration.paymentQR, 'qr');
});

test('sanitizePublicFest strips organizer email and nested competition secrets', () => {
  const result = sanitizePublicFest({
    scannerAccess: { passwordHash: 'secret' },
    organizer: { name: 'Org', email: 'org@example.com', college: 'ABC' },
    registration: { organizerEmail: 'x@y.com', googleSheetsUrl: 'sheets', paymentQR: 'qr' },
    competitions: [{ name: 'Comp', googleSheetsUrl: 'gs', confirmationEmail: 'confirm@x.com' }],
  });

  assert.equal(result.scannerAccess, undefined);
  assert.equal(result.organizer.email, undefined);
  assert.equal(result.registration.organizerEmail, undefined);
  assert.equal(result.registration.googleSheetsUrl, undefined);
  assert.equal(result.registration.paymentQR, 'qr');
  assert.equal(result.competitions[0].googleSheetsUrl, undefined);
  assert.equal(result.competitions[0].confirmationEmail, undefined);
});

test('sanitizePublicCompetition strips direct and nested fest secrets', () => {
  const result = sanitizePublicCompetition({
    googleSheetsUrl: 'gs',
    confirmationEmail: 'confirm@x.com',
    registration: { organizerEmail: 'org@x.com', confirmationEmail: 'confirm2@x.com' },
    fest: { registration: { organizerEmail: 'fest@x.com', paymentQR: 'fest-qr' } },
  });

  assert.equal(result.googleSheetsUrl, undefined);
  assert.equal(result.confirmationEmail, undefined);
  assert.equal(result.registration.organizerEmail, undefined);
  assert.equal(result.registration.confirmationEmail, undefined);
  assert.equal(result.fest.registration.organizerEmail, undefined);
  assert.equal(result.fest.registration.paymentQR, 'fest-qr');
});

test('sanitizePublicRunClub and sanitizePublicEventShow strip sensitive fields', () => {
  const club = sanitizePublicRunClub({ name: 'RC', groupLink: 'https://wa.me/rc', createdBy: 'admin' });
  assert.equal(club.groupLink, undefined);
  assert.equal(club.createdBy, undefined);

  const show = sanitizePublicEventShow({
    title: 'Show',
    googleSheetsUrl: 'sheet',
    organizerEmail: 'org@example.com',
    confirmationEmail: 'confirm@example.com',
    scannerAccess: { code: '123' },
    registration: { organizerEmail: 'inside@example.com', paymentQR: 'qr' },
  });
  assert.equal(show.googleSheetsUrl, undefined);
  assert.equal(show.organizerEmail, undefined);
  assert.equal(show.confirmationEmail, undefined);
  assert.equal(show.scannerAccess, undefined);
  assert.equal(show.registration.organizerEmail, undefined);
  assert.equal(show.registration.paymentQR, 'qr');
});

test('sanitizePublicPlatformEvent strips createdBy', () => {
  const result = sanitizePublicPlatformEvent({
    title: 'Open mic',
    createdBy: 'admin-user-id',
    scannerAccess: { code: 'x' },
    price: 199,
  });
  assert.equal(result.createdBy, undefined);
  assert.equal(result.scannerAccess, undefined);
  assert.equal(result.title, 'Open mic');
  assert.equal(result.price, 199);
});
