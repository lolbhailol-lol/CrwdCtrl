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
export function deriveCompetitionFormat(opts = {}) {
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

export function buildStagesFromFormat(formatInput) {
  const f = deriveCompetitionFormat(formatInput || {});
  return [
    {
      id: 'round1',
      label: 'ROUND 1',
      subtitle: 'CAMPUS HUNT',
      teams: f.round1Teams,
      detail: `All ${f.round1Teams} registered teams compete · ${f.teamSize} people per team.`,
    },
    {
      id: 'survival',
      label: 'SURVIVAL STAGE',
      subtitle: 'ROUND 2',
      teams: f.survivalTeams,
      detail: `Teams ranked ${f.directFromR1 + 1}–${f.round1Teams} after Round 1.`,
    },
    {
      id: 'finale',
      label: 'FINALE',
      subtitle: 'FINAL ROUND',
      teams: f.finaleTeams,
      detail: `${f.directFromR1} direct from Round 1 + ${f.manualPick} from Survival.`,
    },
  ];
}

export function formatLadderLabel(formatInput) {
  const f = deriveCompetitionFormat(formatInput || {});
  return `Round 1 (${f.round1Teams}) → Survival (${f.survivalTeams}) → Finale (${f.finaleTeams} · +${f.directFromR1} direct)`;
}
