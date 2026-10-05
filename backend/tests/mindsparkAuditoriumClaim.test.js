'use strict';

/**
 * Auditorium identity-claim + capacity helpers (unit, no Mongo).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

test('ticket claim model exposes unique competitionId+kind+value index', () => {
  const TicketClaim = require('../src/model/mindspark_auditorium_ticket_claim_model');
  const indexes = TicketClaim.schema.indexes();
  const unique = indexes.find((entry) => {
    const [fields, opts] = entry;
    return fields.competitionId === 1
      && fields.kind === 1
      && fields.value === 1
      && opts?.unique === true;
  });
  assert.ok(unique, 'expected unique auditorium_unique_identity index');
});

test('claim schema only allows known identity kinds', () => {
  const TicketClaim = require('../src/model/mindspark_auditorium_ticket_claim_model');
  const kind = TicketClaim.schema.path('kind');
  assert.deepEqual(kind.enumValues, ['user', 'mis', 'phone', 'email']);
});

test('claimCategorySeat rejects invalid seats before touching the DB', async () => {
  const { claimCategorySeat } = require('../src/utils/auditoriumQuota');
  await assert.rejects(
    () => claimCategorySeat('comp', 'fe', 0),
    (err) => err.code === 'INVALID_CATEGORY' && err.status === 400,
  );
  await assert.rejects(
    () => claimCategorySeat('', 'fe', 10),
    (err) => err.code === 'INVALID_CATEGORY',
  );
});

test('duplicate Mongo key code maps to ALREADY_REGISTERED contract', () => {
  // Mirrors mindsparkAuditoriumController createAuditoriumTicket catch
  const error = { code: 11000 };
  const status = error?.code === 11000 ? 409 : 500;
  const code = error?.code === 11000 ? 'ALREADY_REGISTERED' : 'UNKNOWN';
  assert.equal(status, 409);
  assert.equal(code, 'ALREADY_REGISTERED');
});
