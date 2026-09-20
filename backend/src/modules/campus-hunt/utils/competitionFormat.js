/**
 * Single-game Campus Hunt — one hunt, no qualifying ladder (mirrors frontend).
 */

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

const SINGLE_GAME = true;

const DEFAULT_ROUND_PLAN = {
  round1Name: 'Campus Hunt',
  round2Name: '',
  round3Name: '',
  finaleName: '',
  qualifyFromRound1: 0,
  qualifyFromRound2: 0,
  qualifyFromRound3: 0,
};

function normalizeRoundPlan(raw = {}, opts = {}) {
  const capacity = clampInt(opts.teamCapacity, 2, 200, 20);
  const round1Name = String(
    raw.round1Name || raw.name || DEFAULT_ROUND_PLAN.round1Name,
  ).trim() || 'Campus Hunt';

  return {
    round1Name,
    round2Name: '',
    round3Name: '',
    finaleName: '',
    qualifyFromRound1: 0,
    qualifyFromRound2: 0,
    qualifyFromRound3: 0,
    hasRound2: false,
    hasRound3: false,
    hasFinale: false,
    finaleCapacity: 0,
    singleGame: true,
    teamCapacityHint: capacity,
  };
}

const BASELINE = {
  capacity: 20,
  directFromR1: 0,
  finaleTeams: 0,
};

function deriveCompetitionFormat(opts = {}) {
  const teamCapacity = clampInt(opts.teamCapacity, 2, 200, BASELINE.capacity);
  const teamSize = clampInt(opts.teamSize, 2, 12, 10);
  const plan = normalizeRoundPlan({
    round1Name: opts.round1Name,
    ...(opts.roundPlan || {}),
  }, { teamCapacity });

  return {
    teamCapacity,
    teamSize,
    round1Teams: teamCapacity,
    directFromR1: 0,
    survivalTeams: 0,
    finaleTeams: 0,
    manualPick: 0,
    totalPlayers: teamCapacity * teamSize,
    roundPlan: plan,
    singleGame: true,
    qualification: {
      topNDirectFinale: 0,
      survivalTeams: 0,
      lastChanceTeams: 0,
      finaleTeams: 0,
      nextRoundName: null,
    },
  };
}

function formatSummary(format) {
  const f = format?.qualification ? format : deriveCompetitionFormat(format || {});
  const p = f.roundPlan || normalizeRoundPlan({}, { teamCapacity: f.teamCapacity });
  return {
    ladder: p.round1Name,
    detail: `Single game “${p.round1Name}”: ${f.round1Teams || f.teamCapacity} teams · no qualifying`,
  };
}

module.exports = {
  SINGLE_GAME,
  BASELINE,
  DEFAULT_ROUND_PLAN,
  normalizeRoundPlan,
  deriveCompetitionFormat,
  formatSummary,
};
