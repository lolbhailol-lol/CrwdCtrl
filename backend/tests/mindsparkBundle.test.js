const test = require('node:test');
const assert = require('node:assert/strict');
const { TECH_IDS, NON_TECH_IDS, groupFor, DISCOUNT_PERCENT } = require('../src/modules/fest/plugins/mindsparkBundle');
const { allocate } = require('../src/services/mindsparkBundleService');

test('MindSpark offer keeps explicit 1-tech and 2-non-tech eligibility groups', () => {
  assert.equal(DISCOUNT_PERCENT, 70);
  assert.equal(new Set(TECH_IDS).size, TECH_IDS.length);
  assert.equal(new Set(NON_TECH_IDS).size, NON_TECH_IDS.length);
  assert.equal(TECH_IDS.some(id => NON_TECH_IDS.includes(id)), false);
  assert.equal(groupFor('6a7f158e0e5ff505e2a4c48f'), 'non_technical'); // TAKE OFF
  assert.equal(groupFor('6a7f158e0e5ff505e2a4c492'), 'non_technical'); // TORQUEST
  assert.equal(groupFor('6a7f15b443825c1b6ced8056'), 'technical'); // IDEATHON
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
