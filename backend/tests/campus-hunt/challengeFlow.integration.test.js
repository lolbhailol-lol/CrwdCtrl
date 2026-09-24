/**
 * Pure-logic integration of Round 1 scoring path (no Mongo).
 * start 100 → c1 50 → c2 50 → c3 65 → c4 50 → c5 75
 * → first-place finish award 200 = 590
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeChallengeAward,
  applyAward,
  applyHintDeduction,
} = require('../../src/modules/campus-hunt/services/scoringService');
const { DEFAULT_SCORING_CONFIG } = require('../../src/modules/campus-hunt/constants');
const { pointsForFinishPlace } = require('../../src/modules/campus-hunt/services/finishService');
const {
  canTransition,
  applyCheckpointCompletionCascade,
} = require('../../src/modules/campus-hunt/services/stateMachine');

test('full happy-path score and stages without hints', () => {
  let score = 100;
  let stage = 'WAITING';
  assert.ok(canTransition(stage, 'CLUE_1_ACTIVE'));
  stage = 'CLUE_1_ACTIVE';

  const c1 = computeChallengeAward({
    challengeNumber: 1,
    basePoints: 50,
    awardMode: 'flat_base',
    attemptNumber: 1,
  });
  score = applyAward(score, c1.total);
  stage = 'CLUE_1_COMPLETED';
  assert.equal(c1.total, 50);
  assert.equal(score, 150);

  const team = { currentStage: stage };
  applyCheckpointCompletionCascade(team, '1');
  stage = team.currentStage;
  assert.equal(stage, 'CLUE_2_ACTIVE');

  const c2 = computeChallengeAward({
    challengeNumber: 2,
    basePoints: DEFAULT_SCORING_CONFIG.clue2.basePoints,
    awardMode: 'flat_base',
  });
  score = applyAward(score, c2.total);
  assert.equal(c2.total, 50);
  assert.equal(score, 200);
  stage = 'CLUE_2_COMPLETED';
  team.currentStage = stage;
  applyCheckpointCompletionCascade(team, '2');
  assert.equal(team.currentStage, 'CLUE_3_ACTIVE');

  const c3 = computeChallengeAward({
    challengeNumber: 3,
    basePoints: DEFAULT_SCORING_CONFIG.clue3.basePoints,
    awardMode: 'flat_base',
  });
  score = applyAward(score, c3.total);
  assert.equal(score, 265);
  team.currentStage = 'CLUE_3_COMPLETED';
  applyCheckpointCompletionCascade(team, '3');
  assert.equal(team.currentStage, 'CLUE_4_ACTIVE');

  const c4 = computeChallengeAward({
    challengeNumber: 4,
    basePoints: DEFAULT_SCORING_CONFIG.clue4.basePoints,
    awardMode: 'flat_base',
  });
  score = applyAward(score, c4.total);
  assert.equal(c4.total, 50);
  assert.equal(score, 315);
  team.currentStage = 'CLUE_4_COMPLETED';
  applyCheckpointCompletionCascade(team, '4');
  assert.equal(team.currentStage, 'CLUE_5_ACTIVE');

  const t0 = new Date('2026-01-01T10:00:00Z');
  const c5 = computeChallengeAward({
    challengeNumber: 5,
    basePoints: DEFAULT_SCORING_CONFIG.clue5.basePoints,
    awardMode: 'base_plus_speed',
    timerSeconds: 240,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue5.speedBonusBands,
    startedAt: t0,
    submittedAt: new Date('2026-01-01T10:01:00Z'),
  });
  score = applyAward(score, c5.total);
  assert.equal(c5.total, 75);
  assert.equal(score, 390);
  team.currentStage = 'CLUE_5_COMPLETED';
  applyCheckpointCompletionCascade(team, '5');
  assert.equal(team.currentStage, 'CLUE_6_ACTIVE');

  const finishAward = pointsForFinishPlace(1);
  score = applyAward(score, finishAward);
  assert.equal(finishAward, 200);
  assert.equal(score, 590);
  team.currentStage = 'CLUE_6_COMPLETED';
  applyCheckpointCompletionCascade(team, 'FINISH');
  assert.equal(team.currentStage, 'SCORE_LOCKED');
});

test('late clue still awards 0 but path continues', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const late = new Date('2026-01-01T10:05:00Z');
  const c5 = computeChallengeAward({
    challengeNumber: 5,
    basePoints: DEFAULT_SCORING_CONFIG.clue5.basePoints,
    awardMode: 'base_plus_speed',
    timerSeconds: 240,
    allowLateSubmit: true,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue5.speedBonusBands,
    startedAt,
    submittedAt: late,
  });
  assert.equal(c5.total, 0);
  assert.equal(c5.late, true);
});

test('one hint path yields 570 from a first-place 590 path', () => {
  let score = 590;
  score = applyHintDeduction(score, 20);
  assert.equal(score, 570);
});
