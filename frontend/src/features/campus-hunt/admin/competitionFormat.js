/**
 * Flexible Round 1–3 names + how many teams from each qualify to Finale.
 * Round 1 is always on; Round 2/3 are optional (empty name = not used yet).
 */

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

const DEFAULT_ROUND_PLAN = {
  round1Name: 'Campus Hunt',
  round2Name: '',
  round3Name: '',
  finaleName: 'Finale',
  qualifyFromRound1: 5,
  qualifyFromRound2: 0,
  qualifyFromRound3: 0,
};

/**
 * @param {object} raw
 * @param {{ teamCapacity?: number }} opts
 */
export function normalizeRoundPlan(raw = {}, opts = {}) {
  const capacity = clampInt(opts.teamCapacity, 2, 200, 40);
  const round1Name = String(raw.round1Name || DEFAULT_ROUND_PLAN.round1Name).trim() || 'Campus Hunt';
  const round2Name = String(raw.round2Name || '').trim();
  const round3Name = String(raw.round3Name || '').trim();
  const finaleName = String(raw.finaleName || DEFAULT_ROUND_PLAN.finaleName).trim() || 'Finale';

  let q1 = clampInt(raw.qualifyFromRound1, 0, capacity, DEFAULT_ROUND_PLAN.qualifyFromRound1);
  let q2 = round2Name
    ? clampInt(raw.qualifyFromRound2, 0, capacity, 0)
    : 0;
  let q3 = round3Name
    ? clampInt(raw.qualifyFromRound3, 0, capacity, 0)
    : 0;

  // Round 1 always needs at least 1 finalist if any finals exist; allow 0 only when all zero (R1-only event)
  if (!round2Name && !round3Name && q1 === 0 && q2 === 0 && q3 === 0) {
    q1 = 0; // R1-only / offline — no finals ladder yet
  }

  let finaleCapacity = q1 + q2 + q3;
  if (finaleCapacity > capacity) {
    // Prefer keeping R1 slots, then R2, then R3
    let left = capacity;
    q1 = Math.min(q1, left);
    left -= q1;
    q2 = Math.min(q2, left);
    left -= q2;
    q3 = Math.min(q3, left);
    finaleCapacity = q1 + q2 + q3;
  }

  return {
    round1Name,
    round2Name,
    round3Name,
    finaleName,
    qualifyFromRound1: q1,
    qualifyFromRound2: q2,
    qualifyFromRound3: q3,
    hasRound2: Boolean(round2Name),
    hasRound3: Boolean(round3Name),
    hasFinale: finaleCapacity > 0,
    finaleCapacity,
  };
}

export function roundPlanSummary(planInput, teamCapacity = 40) {
  const p = normalizeRoundPlan(planInput, { teamCapacity });
  const bits = [`R1 “${p.round1Name}”`];
  if (p.hasRound2) bits.push(`R2 “${p.round2Name}”`);
  if (p.hasRound3) bits.push(`R3 “${p.round3Name}”`);
  if (p.hasFinale) {
    bits.push(
      `${p.finaleName}: ${p.qualifyFromRound1} from R1`
        + (p.hasRound2 ? ` + ${p.qualifyFromRound2} from R2` : '')
        + (p.hasRound3 ? ` + ${p.qualifyFromRound3} from R3` : '')
        + ` = ${p.finaleCapacity}`,
    );
  } else {
    bits.push('No finals ladder yet');
  }
  return bits.join(' · ');
}

/** @deprecated ladder helpers — kept for Finale panels that still use them */
const BASELINE = {
  capacity: 40,
  directFromR1: 5,
  finaleTeams: 12,
};

export function deriveCompetitionFormat(opts = {}) {
  const teamCapacity = clampInt(opts.teamCapacity, 2, 200, BASELINE.capacity);
  const teamSize = clampInt(opts.teamSize, 2, 8, 4);
  const plan = normalizeRoundPlan({
    round1Name: opts.round1Name,
    round2Name: opts.round2Name,
    round3Name: opts.round3Name,
    finaleName: opts.finaleName,
    qualifyFromRound1: opts.qualifyFromRound1 ?? opts.directFromR1,
    qualifyFromRound2: opts.qualifyFromRound2,
    qualifyFromRound3: opts.qualifyFromRound3,
  }, { teamCapacity });

  const directFromR1 = plan.qualifyFromRound1 || clampInt(
    opts.directFromR1,
    0,
    teamCapacity,
    plan.hasFinale ? BASELINE.directFromR1 : 0,
  );
  const finaleTeams = plan.finaleCapacity
    || clampInt(opts.finaleTeams, 0, teamCapacity, plan.hasFinale ? BASELINE.finaleTeams : 0);
  const survivalTeams = Math.max(0, teamCapacity - Math.max(directFromR1, 1));
  const manualPick = Math.max(0, finaleTeams - directFromR1);

  return {
    teamCapacity,
    teamSize,
    round1Teams: teamCapacity,
    directFromR1,
    survivalTeams,
    finaleTeams,
    manualPick,
    totalPlayers: teamCapacity * teamSize,
    roundPlan: plan,
    qualification: {
      topNDirectFinale: directFromR1,
      survivalTeams,
      lastChanceTeams: 0,
      finaleTeams,
      nextRoundName: plan.round2Name || 'SURVIVAL_STAGE',
    },
  };
}

export function buildStagesFromFormat(formatInput) {
  const f = deriveCompetitionFormat(formatInput || {});
  const p = f.roundPlan;
  const stages = [
    {
      id: 'round1',
      label: 'ROUND 1',
      subtitle: (p.round1Name || 'CAMPUS HUNT').toUpperCase(),
      teams: f.round1Teams,
      detail: `All ${f.round1Teams} registered teams · ${f.teamSize}/team.`,
    },
  ];
  if (p.hasRound2) {
    stages.push({
      id: 'round2',
      label: 'ROUND 2',
      subtitle: p.round2Name.toUpperCase(),
      teams: f.survivalTeams,
      detail: `${p.qualifyFromRound2} qualify to ${p.finaleName}.`,
    });
  }
  if (p.hasRound3) {
    stages.push({
      id: 'round3',
      label: 'ROUND 3',
      subtitle: p.round3Name.toUpperCase(),
      teams: Math.max(0, f.survivalTeams - p.qualifyFromRound2),
      detail: `${p.qualifyFromRound3} qualify to ${p.finaleName}.`,
    });
  }
  if (p.hasFinale) {
    stages.push({
      id: 'finale',
      label: 'FINALS',
      subtitle: p.finaleName.toUpperCase(),
      teams: p.finaleCapacity,
      detail:
        `${p.qualifyFromRound1} from R1`
        + (p.hasRound2 ? ` + ${p.qualifyFromRound2} from R2` : '')
        + (p.hasRound3 ? ` + ${p.qualifyFromRound3} from R3` : ''),
    });
  }
  return stages;
}

export function formatLadderLabel(formatInput) {
  const f = deriveCompetitionFormat(formatInput || {});
  return roundPlanSummary(f.roundPlan, f.teamCapacity);
}

export { DEFAULT_ROUND_PLAN };
