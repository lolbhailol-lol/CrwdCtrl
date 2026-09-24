const test = require('node:test');
const assert = require('node:assert/strict');

const {
  reconcileOfflineGridScore,
  reconcileOfflineFinishScore,
} = require('../../src/modules/campus-hunt/services/offlineExportService');

test('offline Clue 4 waits for a verified laptop result instead of accepting flat points', () => {
  assert.deepEqual(
    reconcileOfflineGridScore({
      phoneScore: 315,
      flatClue4: 50,
      gridScore: null,
      maxPlausible: 820,
    }),
    { ready: false, score: 315 },
  );
});

test('offline Clue 4 replaces the phone placeholder with the verified Grid score', () => {
  assert.deepEqual(
    reconcileOfflineGridScore({
      phoneScore: 315,
      flatClue4: 50,
      gridScore: 120,
      maxPlausible: 820,
    }),
    { ready: true, score: 385 },
  );
});

test('offline finish waits for placement and swaps 50 for the 200/190 ladder award', () => {
  assert.deepEqual(
    reconcileOfflineFinishScore({
      phoneScore: 440,
      includedClue6: 50,
      finishPoints: null,
      maxPlausible: 820,
    }),
    { ready: false, score: 440 },
  );
  assert.equal(reconcileOfflineFinishScore({
    phoneScore: 440,
    includedClue6: 50,
    finishPoints: 200,
    maxPlausible: 820,
  }).score, 590);
  assert.equal(reconcileOfflineFinishScore({
    phoneScore: 440,
    includedClue6: 50,
    finishPoints: 190,
    maxPlausible: 820,
  }).score, 580);
});
