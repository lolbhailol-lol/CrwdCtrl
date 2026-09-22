const test = require('node:test');
const assert = require('node:assert/strict');

const TicketClaim = require('../src/model/mindspark_auditorium_ticket_claim_model');
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
  const config = normalizeAuditoriumConfig({ enabled: true, categories: defaults.categories });
  assert.equal(config.enabled, true);
  assert.ok(config.categories.length >= 1);
  assert.ok(config.categories.every((category) => Number(category.seats) >= 0));
});
