const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeGenderQuotas,
  buildQuotaSummary,
} = require('../src/utils/trekGenderRegistration');

test('TouchGrass-style quotas: 10 women of 28 total', () => {
  const quotas = sanitizeGenderQuotas({
    enabled: true,
    femaleSeats: 10,
    maleSeats: 18,
    othersSeats: 0,
  });
  assert.equal(quotas.enabled, true);
  assert.equal(quotas.femaleSeats, 10);
  assert.equal(quotas.maleSeats, 18);

  const summary = buildQuotaSummary(quotas, {
    female: { filled: 3 },
    male: { filled: 5 },
    others: { filled: 0 },
  });
  assert.equal(summary.female.remaining, 7);
  assert.equal(summary.male.remaining, 13);
  assert.equal(summary.female.full, false);

  const fullWomen = buildQuotaSummary(quotas, {
    female: { filled: 10 },
    male: { filled: 2 },
    others: { filled: 0 },
  });
  assert.equal(fullWomen.female.full, true);
  assert.equal(fullWomen.male.full, false);
});
