const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BUNDLE_COMPETITION_IDS,
  TECH_IDS,
  NON_TECH_IDS,
  BUNDLES,
  isBundleEligible,
  groupFor,
  assertBundleSelection,
  resolveBundle,
} = require('../src/modules/fest/plugins/mindsparkBundle');
const { allocate } = require('../src/services/mindsparkBundleService');

const tech = TECH_IDS[0];
const tech2 = TECH_IDS[1];
const nonTech = NON_TECH_IDS[0];
const nonTech2 = NON_TECH_IDS[1];

test('MindSpark baskets: hat-trick, tech duo, dynamic duo', () => {
  assert.equal(BUNDLES.length, 3);
  assert.deepEqual(BUNDLES.map((b) => [b.key, b.size, b.discountPercent]), [
    ['hat_trick', 3, 65],
    ['tech_duo', 2, 50],
    ['dynamic_duo', 2, 40],
  ]);
  assert.equal(BUNDLE_COMPETITION_IDS.length, 19);
  assert.equal(new Set(BUNDLE_COMPETITION_IDS).size, 19);
  assert.equal(TECH_IDS.length + NON_TECH_IDS.length, 19);
  assert.equal(isBundleEligible('6a7f15b543825c1b6ced805c'), false); // GOOGLER removed
  assert.equal(isBundleEligible('6ab9616b9da31251f82b3ab6'), true);
  assert.equal(groupFor('6ab9616b9da31251f82b3ab6'), 'non_technical');
  assert.equal(isBundleEligible('6a7f158e0e5ff505e2a4c495'), true);
  assert.equal(isBundleEligible('6a7f158f0e5ff505e2a4c49e'), false); // FUSION ID removed
  assert.equal(groupFor(tech), 'technical');
  assert.equal(groupFor(nonTech), 'non_technical');
});

test('tech duo rejects non-tech; dynamic duo requires one of each', () => {
  assert.doesNotThrow(() => assertBundleSelection(resolveBundle('tech_duo'), [tech, tech2]));
  assert.throws(() => assertBundleSelection(resolveBundle('tech_duo'), [tech, nonTech]), /tech events/);
  assert.doesNotThrow(() => assertBundleSelection(resolveBundle('dynamic_duo'), [tech, nonTech]));
  assert.throws(() => assertBundleSelection(resolveBundle('dynamic_duo'), [tech, tech2]), /1 tech/);
  assert.throws(() => assertBundleSelection(resolveBundle('dynamic_duo'), [nonTech, nonTech2]), /1 tech/);
  assert.doesNotThrow(() => assertBundleSelection(resolveBundle('hat_trick'), [tech, tech2, nonTech]));
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
