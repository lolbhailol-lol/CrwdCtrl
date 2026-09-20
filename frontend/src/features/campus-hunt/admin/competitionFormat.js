/**
 * Single-game Campus Hunt — one hunt, no qualifying ladder, no Survival / Finals.
 */

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Always a single game — R2 / R3 / finals are not used. */
export const SINGLE_GAME = true;

export const DEFAULT_ROUND_PLAN = {
  round1Name: 'Campus Hunt',
  round2Name: '',
  round3Name: '',
  finaleName: '',
  qualifyFromRound1: 0,
  qualifyFromRound2: 0,
  qualifyFromRound3: 0,
};

/**
 * @param {object} raw
 * @param {{ teamCapacity?: number }} opts
 */
export function normalizeRoundPlan(raw = {}, opts = {}) {
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

export function roundPlanSummary(planInput, teamCapacity = 20) {
  const p = normalizeRoundPlan(planInput, { teamCapacity });
  const n = clampInt(teamCapacity, 2, 200, 20);
  return `Single game “${p.round1Name}” · ${n} teams · no qualifying`;
}

const BASELINE = {
  capacity: 20,
  directFromR1: 0,
  finaleTeams: 0,
};

export function deriveCompetitionFormat(opts = {}) {
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

export function buildStagesFromFormat(formatInput) {
  const f = deriveCompetitionFormat(formatInput || {});
  const p = f.roundPlan;
  return [
    {
      id: 'round1',
      label: 'THE HUNT',
      subtitle: (p.round1Name || 'CAMPUS HUNT').toUpperCase(),
      teams: f.round1Teams,
      detail: `${f.round1Teams} teams · ${f.teamSize}/team · one game · finish at lobby.`,
    },
  ];
}

export function formatLadderLabel(formatInput) {
  const f = deriveCompetitionFormat(formatInput || {});
  return roundPlanSummary(f.roundPlan, f.teamCapacity);
}
