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
  // Fallback: later attempts than listed → 0
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
 * Clue 1 (attempt_bands): attempt 1=20, 2=10, 3=5.
 * Clue 2 (time_bands_total): ≤1m=50, ≤2m=30, ≤5m=10, else 0 (late).
 * Clue 3: base only.
 * Clue 4: base + speed bands.
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
}) {
  const n = Number(challengeNumber);
  const mode = awardMode
    || (n === 1 ? 'attempt_bands' : n === 2 ? 'time_bands_total' : 'base_plus_speed');

  if (n === 1 || mode === 'attempt_bands') {
    const total = pointsFromAttemptBands(attemptNumber, attemptBands);
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
    const limit = Number(timerSeconds) || 300;
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
  let speedBonus = 0;
  if (n === 4) {
    if (elapsed != null) {
      speedBonus = speedBonusFromBands(elapsed, speedBonusBands);
    }
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

/** Max: start 100 + clue1 20 + clue2 50 + clue3 75 + clue4 120 = 365 */
function theoreticalMaxScore(scoringConfig) {
  const start = scoringConfig?.startingScore ?? 100;
  const c1Bands = scoringConfig?.clue1?.attemptBands || [];
  const c1 = Math.max(0, ...c1Bands.map((b) => Number(b.points) || 0), 0);
  const c2Bands = scoringConfig?.clue2?.speedBonusBands || [];
  const c2 = Math.max(0, ...c2Bands.map((b) => Number(b.bonus) || 0), 0);
  const c3 = scoringConfig?.clue3?.basePoints ?? 75;
  const c4 = (scoringConfig?.clue4?.basePoints ?? 100)
    + Math.max(0, ...(scoringConfig?.clue4?.speedBonusBands || []).map((b) => b.bonus), 0);
  return start + c1 + c2 + c3 + c4;
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
