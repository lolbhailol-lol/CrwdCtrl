import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeCompetitionFeeTiers,
  formatCompetitionFeeFromLabel,
  minCompetitionFeeAmount,
} from '../src/utils/competitionFeeTiers.js';

test('Game of Innovation fee tiers list all amounts', () => {
  const tiers = sanitizeCompetitionFeeTiers([
    { id: 'under_18', label: 'Under 18 students', amount: 150 },
    { id: 'ug', label: 'UG students', amount: 300 },
    { id: 'pg_phd', label: 'PG students / PhD Scholars', amount: 500 },
  ]);
  assert.equal(tiers.length, 3);
  assert.equal(minCompetitionFeeAmount(tiers), 150);
  assert.equal(formatCompetitionFeeFromLabel(tiers), '₹150 · ₹300 · ₹500');
});

test('empty feeTiers stay empty', () => {
  assert.deepEqual(sanitizeCompetitionFeeTiers(undefined), []);
});
