/**
 * Flexible Round 1–3 names + finals qualification (mirrors frontend competitionFormat).
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

function normalizeRoundPlan(raw = {}, opts = {}) {
  const capacity = clampInt(opts.teamCapacity, 2, 200, 40);
  const round1Name = String(raw.round1Name || DEFAULT_ROUND_PLAN.round1Name).trim() || 'Campus Hunt';
  const round2Name = String(raw.round2Name || '').trim();
  const round3Name = String(raw.round3Name || '').trim();
  const finaleName = String(raw.finaleName || DEFAULT_ROUND_PLAN.finaleName).trim() || 'Finale';

  let q1 = clampInt(raw.qualifyFromRound1, 0, capacity, DEFAULT_ROUND_PLAN.qualifyFromRound1);
  let q2 = round2Name ? clampInt(raw.qualifyFromRound2, 0, capacity, 0) : 0;
  let q3 = round3Name ? clampInt(raw.qualifyFromRound3, 0, capacity, 0) : 0;

  if (!round2Name && !round3Name && q1 === 0 && q2 === 0 && q3 === 0) {
    q1 = 0;
  }

  let finaleCapacity = q1 + q2 + q3;
  if (finaleCapacity > capacity) {
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

const BASELINE = {
  capacity: 40,
  directFromR1: 5,
  finaleTeams: 12,
};

function deriveCompetitionFormat(opts = {}) {
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
    ...(opts.roundPlan || {}),
  }, { teamCapacity });

  const directFromR1 = plan.qualifyFromRound1;
  const finaleTeams = plan.finaleCapacity;
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

function formatSummary(format) {
  const f = format?.qualification ? format : deriveCompetitionFormat(format || {});
  const p = f.roundPlan || normalizeRoundPlan({}, { teamCapacity: f.teamCapacity });
  return {
    ladder: p.hasFinale
      ? `${p.round1Name} → ${p.finaleName} (${p.finaleCapacity})`
      : p.round1Name,
    detail:
      `${p.round1Name}: ${f.round1Teams || f.teamCapacity} teams`
      + (p.hasFinale
        ? ` · finals ${p.finaleCapacity} (${p.qualifyFromRound1} from R1`
          + (p.hasRound2 ? ` + ${p.qualifyFromRound2} from R2` : '')
          + (p.hasRound3 ? ` + ${p.qualifyFromRound3} from R3` : '')
          + ')'
        : ''),
  };
}

module.exports = {
  BASELINE,
  DEFAULT_ROUND_PLAN,
  normalizeRoundPlan,
  deriveCompetitionFormat,
  formatSummary,
};
