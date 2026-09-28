const test = require('node:test');
const assert = require('node:assert/strict');

const TicketClaim = require('../src/model/mindspark_auditorium_ticket_claim_model');
const AuditoriumStudent = require('../src/model/mindspark_auditorium_student_model');
const AuditoriumOtp = require('../src/model/mindspark_auditorium_otp_model');
const { occupiedFilter } = require('../src/utils/auditoriumQuota');
const {
  defaultAuditoriumConfig,
  normalizeAuditoriumConfig,
} = require('../src/modules/fest/plugins/mindsparkAuditorium');

test('auditorium identity claims enforce one atomic claim per identity', () => {
  const uniqueIndex = TicketClaim.schema.indexes().find(([fields, options]) => (
    fields.competitionId === 1
    && fields.kind === 1
    && fields.value === 1
    && options.unique === true
  ));
  assert.ok(uniqueIndex, 'compound unique identity index is required');
});

test('auditorium OTP challenges do not require a Google-linked user', () => {
  assert.equal(AuditoriumOtp.schema.path('userId').options.required, undefined);
  assert.equal(AuditoriumOtp.schema.path('emailHash').options.required, true);
});

test('auditorium student directory accepts postgraduate categories', () => {
  const path = AuditoriumStudent.schema.path('categoryId');
  assert.ok(path.enumValues.includes('mtech'));
  assert.ok(path.enumValues.includes('mba'));
});

test('auditorium quota counts only issued free or paid tickets', () => {
  const filter = occupiedFilter('competition', 'first_year');
  assert.deepEqual(filter.status.$in, ['approved', 'pending']);
  assert.deepEqual(filter.$or, [
    { paymentStatus: 'free' },
    { paymentStatus: 'paid' },
  ]);
  assert.equal(filter['responses.auditorium_category_id'], 'first_year');
});

test('auditorium config normalization keeps safe defaults and seat categories', () => {
  const defaults = defaultAuditoriumConfig();
  assert.equal(defaults.requireDirectoryOtp, false);
  const config = normalizeAuditoriumConfig({ enabled: true, categories: defaults.categories });
  assert.equal(config.enabled, true);
  assert.ok(config.categories.length >= 1);
  assert.ok(config.categories.every((category) => Number(category.seats) >= 0));
  assert.ok(config.categories.every((category) => category.enabled === true));
});

test('auditorium config no longer asks for or enforces MIS numbers', () => {
  const config = normalizeAuditoriumConfig({ enforceMisYear: true });
  assert.equal(Object.hasOwn(config, 'enforceMisYear'), false);
});

test('auditorium config preserves directory OTP switch', () => {
  const config = normalizeAuditoriumConfig({ requireDirectoryOtp: true });
  assert.equal(config.requireDirectoryOtp, true);
});

test('auditorium config preserves independent category switches', () => {
  const defaults = defaultAuditoriumConfig();
  const categories = defaults.categories.map((category) => (
    category.id === 'first_year' ? { ...category, enabled: false } : category
  ));
  const config = normalizeAuditoriumConfig({ enabled: true, categories });

  assert.equal(config.categories.find((category) => category.id === 'first_year').enabled, false);
  assert.equal(config.categories.find((category) => category.id === 'second_year').enabled, true);
});
