const test = require('node:test');
const assert = require('node:assert/strict');

const { FINALE_DEFAULTS } = require('../../../src/modules/campus-hunt/constants');

test('finale field size: 5 direct + 7 manual = 12', () => {
  assert.equal(
    FINALE_DEFAULTS.directFromR1 + FINALE_DEFAULTS.manualPick,
    FINALE_DEFAULTS.maxFinalists,
  );
});

test('promotion cap helpers reject overflow', () => {
  const { directFromR1, manualPick, maxFinalists } = FINALE_DEFAULTS;

  function wouldExceedManual(manualCount, newPicks) {
    return manualCount + newPicks > manualPick;
  }

  function wouldExceedTotal(total, newPicks) {
    return total + newPicks > maxFinalists;
  }

  assert.equal(wouldExceedManual(7, 1), true);
  assert.equal(wouldExceedManual(6, 1), false);
  assert.equal(wouldExceedTotal(12, 1), true);
  assert.equal(wouldExceedTotal(11, 1), false);
  assert.equal(directFromR1, 5);
});

test('starting score and duration match plan', () => {
  assert.equal(FINALE_DEFAULTS.startingScore, 500);
  assert.equal(FINALE_DEFAULTS.durationMinutes, 45);
});
