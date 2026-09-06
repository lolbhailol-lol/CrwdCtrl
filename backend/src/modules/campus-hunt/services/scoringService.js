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
 * Clue 1 / 3 (flat_base): 50 on correct.
 * Clue 2 (time_bands_total): ≤1m=50, ≤2m=30, ≤3m=10, else 0 (late).
 * Clue 4 (base_plus_speed): 50 + speed bonus; late = 0 but still advances.
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
    || (n === 1 || n === 3
      ? 'flat_base'
      : n === 2
        ? 'time_bands_total'
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

  if (mode === 'flat_base' || n === 1 || n === 3) {
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

  if (n === 2 || mode === 'time_bands_total') {
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

/** Max: start 100 + clue1 50 + clue2 50 + clue3 50 + clue4 50 + clue5 75 = 375 */
function theoreticalMaxScore(scoringConfig) {
  const start = scoringConfig?.startingScore ?? 100;
  const c1Mode = scoringConfig?.clue1?.awardMode || 'flat_base';
  const c1 = c1Mode === 'attempt_bands'
    ? Math.max(0, ...(scoringConfig?.clue1?.attemptBands || []).map((b) => Number(b.points) || 0), 0)
    : (scoringConfig?.clue1?.basePoints ?? 50);
  const c2Bands = scoringConfig?.clue2?.speedBonusBands || [];
  const c2 = Math.max(0, ...c2Bands.map((b) => Number(b.bonus) || 0), 0);
  const c3 = scoringConfig?.clue3?.basePoints ?? 50;
  const c4Bands = scoringConfig?.clue4?.speedBonusBands || [];
  const c4 = Math.max(0, ...c4Bands.map((b) => Number(b.bonus) || 0), Number(scoringConfig?.clue4?.basePoints) || 0, 0);
  const c5 = (scoringConfig?.clue5?.basePoints ?? 50)
    + Math.max(0, ...(scoringConfig?.clue5?.speedBonusBands || []).map((b) => Number(b.bonus) || 0), 0);
  return start + c1 + c2 + c3 + c4 + c5;
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
