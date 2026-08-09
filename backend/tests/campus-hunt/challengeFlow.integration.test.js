/**
 * Pure-logic integration of Round 1 scoring path (no Mongo).
 * Simulates: start 100 → clue2 +70 → clue3 +75 → clue4 +120 → one hint -15 = 350
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeChallengeAward,
  applyAward,
  applyHintDeduction,
} = require('../../src/modules/campus-hunt/services/scoringService');
const { DEFAULT_SCORING_CONFIG } = require('../../src/modules/campus-hunt/constants');
const {
  canTransition,
  applyCheckpointCompletionCascade,
} = require('../../src/modules/campus-hunt/services/stateMachine');

test('full happy-path score and stages without hints', () => {
  let score = 100;
  let stage = 'WAITING';
  assert.ok(canTransition(stage, 'CLUE_1_ACTIVE'));
  stage = 'CLUE_1_ACTIVE';

  // Clue 1 correct on 1st attempt → 20 points
  const c1 = computeChallengeAward({
    challengeNumber: 1,
    awardMode: 'attempt_bands',
    attemptBands: DEFAULT_SCORING_CONFIG.clue1.attemptBands,
    attemptNumber: 1,
  });
  score = applyAward(score, c1.total);
  stage = 'CLUE_1_COMPLETED';
  assert.equal(c1.total, 20);
  assert.equal(score, 120);

  const team = { currentStage: stage };
  applyCheckpointCompletionCascade(team, '1');
  stage = team.currentStage;
  assert.equal(stage, 'CLUE_2_ACTIVE');

  const t0 = new Date('2026-01-01T10:00:00Z');
  const t1 = new Date('2026-01-01T10:01:00Z');
  const c2 = computeChallengeAward({
    challengeNumber: 2,
    basePoints: 0,
    awardMode: 'time_bands_total',
    timerSeconds: 300,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue2.speedBonusBands,
    startedAt: t0,
    submittedAt: t1,
  });
  score = applyAward(score, c2.total);
  assert.equal(c2.total, 50);
  assert.equal(score, 170);
  stage = 'CLUE_2_COMPLETED';
  team.currentStage = stage;
  applyCheckpointCompletionCascade(team, '2');
  assert.equal(team.currentStage, 'CLUE_3_ACTIVE');

  const c3 = computeChallengeAward({
    challengeNumber: 3,
    basePoints: 75,
  });
  score = applyAward(score, c3.total);
  assert.equal(score, 245);
  team.currentStage = 'CLUE_3_COMPLETED';
  applyCheckpointCompletionCascade(team, '3');
  assert.equal(team.currentStage, 'CLUE_4_ACTIVE');

  const c4 = computeChallengeAward({
    challengeNumber: 4,
    basePoints: 100,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue4.speedBonusBands,
    startedAt: t0,
    submittedAt: new Date('2026-01-01T10:02:00Z'),
  });
  score = applyAward(score, c4.total);
  assert.equal(score, 365);
  team.currentStage = 'CLUE_4_COMPLETED';
  applyCheckpointCompletionCascade(team, 'FINISH');
  assert.equal(team.currentStage, 'SCORE_LOCKED');
});

test('one hint path yields 350 from max 365', () => {
  let score = 365;
  score = applyHintDeduction(score, 15);
  assert.equal(score, 350);
});

