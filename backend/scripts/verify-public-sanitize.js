/**
 * Smoke-verify publicEntitySanitize strips internal fields while keeping booking UX fields.
 * Run: node backend/scripts/verify-public-sanitize.js
 */
const {
  sanitizePublicTrek,
  sanitizePublicSportsEvent,
  sanitizePublicFest,
  sanitizePublicCompetition,
  sanitizePublicRunClub,
} = require('../src/utils/publicEntitySanitize');

const leaks = [];

const trek = sanitizePublicTrek({
  trekName: 'Test',
  groupLink: 'https://wa.me/secret',
  scannerAccess: { passwordHash: 'hash', code: 'ABC' },
  createdBy: 'admin',
  registration: {
    organizerEmail: 'org@x.com',
    googleSheetsUrl: 'https://sheets',
    confirmationEmail: 'c@x.com',
    paymentQR: 'https://qr',
    paymentUpiId: 'upi@pay',
    formSchema: [{ name: 'a' }],
  },
  communityId: { name: 'C', groupLink: 'https://wa.me/c' },
});

if (trek.groupLink || trek.scannerAccess || trek.createdBy) leaks.push('trek.top');
if (trek.registration.organizerEmail || trek.registration.googleSheetsUrl || trek.registration.confirmationEmail) {
  leaks.push('trek.reg');
}
if (trek.communityId.groupLink) leaks.push('trek.community');
if (trek.registration.paymentQR !== 'https://qr' || trek.registration.paymentUpiId !== 'upi@pay') {
  leaks.push('trek.booking');
}

const sports = sanitizePublicSportsEvent({
  title: 'Run',
  groupLink: 'https://wa.me/run',
  scannerAccess: { passwordHash: 'x' },
  registration: { organizerEmail: 'a@b.com', googleSheetsUrl: 's', paymentQR: 'q', formSchema: [] },
  runClub: { name: 'RC', groupLink: 'g' },
});
if (sports.groupLink || sports.scannerAccess || sports.registration.organizerEmail || sports.runClub.groupLink) {
  leaks.push('sports');
}
if (sports.registration.paymentQR !== 'q') leaks.push('sports.qr');

const fest = sanitizePublicFest({
  festName: 'F',
  scannerAccess: { passwordHash: 'h' },
  organizer: { name: 'O', email: 'o@x.com', college: 'C' },
  registration: { organizerEmail: 'e', googleSheetsUrl: 's', paymentQR: 'p', formSchema: [] },
  competitions: [{ name: 'Comp', googleSheetsUrl: 'gs', confirmationEmail: 'ce' }],
});
if (fest.scannerAccess || fest.organizer.email || fest.registration.organizerEmail) leaks.push('fest');
if (fest.competitions[0].googleSheetsUrl || fest.competitions[0].confirmationEmail) leaks.push('fest.comp');

const club = sanitizePublicRunClub({ name: 'RC', groupLink: 'wa', createdBy: 'x' });
if (club.groupLink || club.createdBy) leaks.push('club');

const comp = sanitizePublicCompetition({
  name: 'X',
  googleSheetsUrl: 'gs',
  registration: { confirmationEmail: 'c', formSchema: [] },
  fest: { registration: { organizerEmail: 'e', paymentQR: 'qr' } },
});
if (comp.googleSheetsUrl || comp.registration.confirmationEmail || comp.fest.registration.organizerEmail) {
  leaks.push('comp');
}
if (comp.fest.registration.paymentQR !== 'qr') leaks.push('comp.qr');

if (leaks.length) {
  console.error('FAIL', leaks.join(', '));
  process.exit(1);
}
console.log('PASS publicEntitySanitize verification');
