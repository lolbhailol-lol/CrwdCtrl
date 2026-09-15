const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_HOME_SECTION_LABELS,
  DEFAULT_HUB_SECTION_LABELS,
  buildPublicConfig,
  normalizeAppCopyWrite,
  sanitizePublicHref,
  sanitizeAnnouncement,
} = require('../src/utils/publicAppConfig');

test('buildPublicConfig fills defaults when storage is empty', () => {
  const config = buildPublicConfig();
  assert.equal(config.version, 1);
  assert.equal(config.labels.home.ongoing, DEFAULT_HOME_SECTION_LABELS.ongoing);
  assert.equal(config.labels.fests.upcoming, DEFAULT_HUB_SECTION_LABELS.fests.upcoming);
  assert.equal(config.labels.treks.weekendPlans, DEFAULT_HUB_SECTION_LABELS.treks.weekendPlans);
  assert.equal(config.announcement.enabled, false);
  assert.equal(config.emptyStates.fests.none, 'No fests available yet');
});

test('buildPublicConfig allowlists label keys and strips HTML', () => {
  const config = buildPublicConfig({
    homeLabels: { ongoing: '  Live now  ', secret: 'should-not-leak', happening: '<b>Near you</b>' },
    hubLabels: { fests: { upcoming: 'Coming up', extra: 'nope' } },
  });
  assert.equal(config.labels.home.ongoing, 'Live now');
  assert.equal(config.labels.home.happening, 'Near you');
  assert.equal(config.labels.home.secret, undefined);
  assert.equal(config.labels.fests.upcoming, 'Coming up');
  assert.equal(config.labels.fests.extra, undefined);
  assert.equal(config.labels.fests.ongoing, DEFAULT_HUB_SECTION_LABELS.fests.ongoing);
});

test('sanitizePublicHref allows relative paths and crwdctrl.in only', () => {
  assert.equal(sanitizePublicHref('/fests'), '/fests');
  assert.equal(sanitizePublicHref('https://www.crwdctrl.in/treks'), 'https://www.crwdctrl.in/treks');
  assert.equal(sanitizePublicHref('https://crwdctrl.in/sports'), 'https://crwdctrl.in/sports');
  assert.equal(sanitizePublicHref('javascript:alert(1)'), '');
  assert.equal(sanitizePublicHref('https://evil.example/phish'), '');
  assert.equal(sanitizePublicHref('//evil.example'), '');
  assert.equal(sanitizePublicHref('http://crwdctrl.in/x'), '');
});

test('sanitizeAnnouncement requires text before enabling', () => {
  assert.equal(sanitizeAnnouncement({ enabled: true, text: '' }).enabled, false);
  assert.equal(sanitizeAnnouncement({ enabled: true, text: '  Hello campus  ' }).enabled, true);
  assert.equal(sanitizeAnnouncement({ enabled: true, text: 'Hello', href: 'https://evil.test' }).href, '');
  assert.equal(sanitizeAnnouncement({ enabled: true, text: 'Hello', href: '/events' }).href, '/events');
});

test('normalizeAppCopyWrite drops unknown groups and mass-assignment keys', () => {
  const clean = normalizeAppCopyWrite({
    labels: {
      home: { ongoing: 'Now', apiKey: 'secret' },
      fests: { upcoming: 'Soon' },
      admin: { hidden: 'nope' },
    },
    emptyStates: { fests: { none: 'Nothing here' } },
    announcement: { enabled: true, text: 'Sale', href: '/coupons' },
    mongoUri: 'mongodb://secret',
  });
  assert.equal(clean.homeLabels.ongoing, 'Now');
  assert.equal(clean.homeLabels.apiKey, undefined);
  assert.equal(clean.hubLabels.fests.upcoming, 'Soon');
  assert.equal(clean.hubLabels.admin, undefined);
  assert.equal(clean.emptyStates.fests.none, 'Nothing here');
  assert.equal(clean.announcement.text, 'Sale');
  assert.equal(clean.mongoUri, undefined);
});
