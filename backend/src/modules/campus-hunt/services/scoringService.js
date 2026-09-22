/**
 * Server-side scoring. Never trust client-provided points.
 */

function speedBonusFromBands(elapsedSeconds, bands = []) {
  if (!Array.isArray(bands) || bands.length === 0) return 0;
  const elapsed = Number(elapsedSeconds);
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  const sorted = [...bands].sort((a, b) => a.maxSeconds - b.maxSeconds);
  for (const band of sorted) {
    if (elapsed <= band.maxSeconds) return Number(band.bonus) || 0;
  }
  return 0;
}

function pointsFromAttemptBands(attemptNumber, bands = []) {
  const n = Number(attemptNumber);
  if (!Number.isFinite(n) || n < 1 || !Array.isArray(bands)) return 0;
  const hit = bands.find((b) => Number(b.attempt) === n);
  if (hit) return Number(hit.points) || 0;
  return 0;
}

function elapsedSecondsBetween(startedAt, submittedAt) {
  if (!startedAt || !submittedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(submittedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

/**
 * Compute points for a successful challenge completion.
 * Flat clues (1/2/3/4/6): basePoints on correct.
 * Clue 5 (base_plus_speed): base + speed bonus; late = 0 but still advances.
 */
function computeChallengeAward({
  challengeNumber,
  basePoints = 0,
  speedBonusBands = [],
  attemptBands = [],
  attemptNumber,
  startedAt,
  submittedAt,
  awardMode,
  timerSeconds,
  allowLateSubmit = false,
}) {
  const n = Number(challengeNumber);
  const mode = awardMode
    || (n === 1 || n === 2 || n === 3 || n === 4 || n === 6
      ? 'flat_base'
      : 'base_plus_speed');

  if (mode === 'attempt_bands') {
    const total = pointsFromAttemptBands(attemptNumber, attemptBands);
    return {
      basePoints: total,
      speedBonus: 0,
      total,
      late: false,
      attemptNumber: Number(attemptNumber) || null,
    };
  }

  if (mode === 'flat_base' || n === 1 || n === 2 || n === 3 || n === 4 || n === 6) {
    const total = Number(basePoints) || 0;
    return {
      basePoints: total,
      speedBonus: 0,
      total,
      late: false,
      attemptNumber: Number(attemptNumber) || null,
    };
  }

  const elapsed = elapsedSecondsBetween(startedAt, submittedAt);

  if (mode === 'time_bands_total') {
    const limit = Number(timerSeconds) || 180;
    if (elapsed == null || elapsed > limit) {
      return { basePoints: 0, speedBonus: 0, total: 0, late: true, elapsedSeconds: elapsed };
    }
    const award = speedBonusFromBands(elapsed, speedBonusBands);
    return {
      basePoints: 0,
      speedBonus: award,
      total: award,
      late: false,
      elapsedSeconds: elapsed,
    };
  }

  const base = Number(basePoints) || 0;
  const limit = Number(timerSeconds) || 0;
  if (limit > 0 && (elapsed == null || elapsed > limit)) {
    return {
      basePoints: 0,
      speedBonus: 0,
      total: 0,
      late: true,
      elapsedSeconds: elapsed,
      allowLateSubmit: Boolean(allowLateSubmit),
    };
  }

  let speedBonus = 0;
  if (elapsed != null) {
    speedBonus = speedBonusFromBands(elapsed, speedBonusBands);
  }
  return {
    basePoints: base,
    speedBonus,
    total: base + speedBonus,
    late: false,
    elapsedSeconds: elapsed,
  };
}

function applyHintDeduction(currentScore, hintCost = 15) {
  const cost = Number(hintCost) || 0;
  const score = Number(currentScore) || 0;
  return Math.max(0, score - cost);
}

function applyAward(currentScore, awardTotal) {
  return (Number(currentScore) || 0) + (Number(awardTotal) || 0);
}

function applyManualPenalty(currentScore, penalty) {
  return Math.max(0, (Number(currentScore) || 0) - Math.abs(Number(penalty) || 0));
}

function removeManualPenalty(currentScore, penalty) {
  return (Number(currentScore) || 0) + Math.abs(Number(penalty) || 0);
}

/** Max: start 100 + c1 50 + c2 50 + c3 65 + c4 50 + c5 75 + c6 30 = 420 */
function theoreticalMaxScore(scoringConfig) {
  const start = scoringConfig?.startingScore ?? 100;
  const c1Mode = scoringConfig?.clue1?.awardMode || 'flat_base';
  const c1 = c1Mode === 'attempt_bands'
    ? Math.max(0, ...(scoringConfig?.clue1?.attemptBands || []).map((b) => Number(b.points) || 0), 0)
    : (scoringConfig?.clue1?.basePoints ?? 50);
  const c2 = scoringConfig?.clue2?.basePoints ?? 50;
  const c3 = scoringConfig?.clue3?.basePoints ?? 65;
  const c4 = Number(scoringConfig?.clue4?.basePoints) || 50;
  const c5 = Number(scoringConfig?.clue5?.basePoints) || 45;
  const c5Bonus = Math.max(
    0,
    ...(scoringConfig?.clue5?.speedBonusBands || []).map((band) => Number(band.bonus) || 0),
  );
  const c6 = scoringConfig?.clue6?.basePoints ?? 30;
  return start + c1 + c2 + c3 + c4 + c5 + c5Bonus + c6;
}

module.exports = {
  speedBonusFromBands,
  pointsFromAttemptBands,
  elapsedSecondsBetween,
  computeChallengeAward,
  applyHintDeduction,
  applyAward,
  applyManualPenalty,
  removeManualPenalty,
  theoreticalMaxScore,
};
