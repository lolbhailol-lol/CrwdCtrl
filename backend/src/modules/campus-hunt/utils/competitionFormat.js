/**
 * Derive Round 1 → Survival → Finale ladder from overall team capacity.
 * Baseline (40): top 5 direct → Finale, 35 Survival, Finale field 12 (5+7).
 */

const BASELINE = {
  capacity: 40,
  directFromR1: 5,
  finaleTeams: 12,
};

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * @param {{ teamCapacity?: number, teamSize?: number, directFromR1?: number, finaleTeams?: number }} opts
 */
function deriveCompetitionFormat(opts = {}) {
  const teamCapacity = clampInt(opts.teamCapacity, 2, 200, BASELINE.capacity);
  const teamSize = clampInt(opts.teamSize, 2, 8, 4);

  let directFromR1 = opts.directFromR1 != null
    ? clampInt(opts.directFromR1, 1, teamCapacity, BASELINE.directFromR1)
    : Math.max(1, Math.min(
      Math.round((teamCapacity * BASELINE.directFromR1) / BASELINE.capacity),
      Math.floor(teamCapacity / 2) || 1,
    ));

  let finaleTeams = opts.finaleTeams != null
    ? clampInt(opts.finaleTeams, 1, teamCapacity, BASELINE.finaleTeams)
    : Math.max(directFromR1, Math.min(
      Math.round((teamCapacity * BASELINE.finaleTeams) / BASELINE.capacity),
      teamCapacity,
    ));

  if (finaleTeams < directFromR1) {
    directFromR1 = finaleTeams;
  }

  const survivalTeams = Math.max(0, teamCapacity - directFromR1);
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
    qualification: {
      topNDirectFinale: directFromR1,
      survivalTeams,
      lastChanceTeams: 0,
      finaleTeams,
      nextRoundName: 'SURVIVAL_STAGE',
    },
  };
}

function formatSummary(format) {
  const f = format?.qualification ? format : deriveCompetitionFormat(format || {});
  return {
    ladder: `${f.round1Teams || f.teamCapacity} → ${f.survivalTeams} → ${f.finaleTeams}`,
    detail:
      `Round 1: ${f.round1Teams || f.teamCapacity} teams · `
      + `top ${f.directFromR1} direct to Finale · `
      + `${f.survivalTeams} Survival · `
      + `Finale ${f.finaleTeams} (+${f.manualPick} from Survival)`,
  };
}

module.exports = {
  BASELINE,
  deriveCompetitionFormat,
  formatSummary,
};
