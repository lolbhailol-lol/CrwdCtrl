const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BUNDLE_COMPETITION_IDS,
  DISCOUNT_PERCENT,
  BUNDLE_SIZE,
  isBundleEligible,
  groupFor,
} = require('../src/modules/fest/plugins/mindsparkBundle');
const { allocate } = require('../src/services/mindsparkBundleService');

test('MindSpark bundle is any 3 from the approved list at 65% off', () => {
  assert.equal(DISCOUNT_PERCENT, 65);
  assert.equal(BUNDLE_SIZE, 3);
  assert.equal(BUNDLE_COMPETITION_IDS.length, 21);
  assert.equal(new Set(BUNDLE_COMPETITION_IDS).size, BUNDLE_COMPETITION_IDS.length);
  assert.equal(isBundleEligible('6a7f158e0e5ff505e2a4c495'), true); // CODE JUNKIE
  assert.equal(isBundleEligible('6a7f158f0e5ff505e2a4c4ad'), false); // HACKATHON not in list
  assert.equal(groupFor('6a7f158e0e5ff505e2a4c48f'), 'bundle'); // TAKE OFF
});

test('bundle allocation exactly reconciles to the one Cashfree payment', () => {
  const amounts = allocate(209, [{ originalAmount: 199 }, { originalAmount: 199 }, { originalAmount: 299 }]);
  assert.equal(amounts.reduce((sum, amount) => sum + amount, 0), 209);
  assert.deepEqual(amounts, [60, 60, 89]);
});

test('zero-fee bundle allocation stays finite and skips proportional division', () => {
  const amounts = allocate(0, [{ originalAmount: 0 }, { originalAmount: 0 }, { originalAmount: 0 }]);
  assert.deepEqual(amounts, [0, 0, 0]);
  assert.equal(amounts.every(Number.isFinite), true);
});
