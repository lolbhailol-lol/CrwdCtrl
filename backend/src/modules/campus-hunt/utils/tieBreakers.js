/**
 * Deterministic Round 1 ranking.
 * Higher score wins; ties broken by:
 * 1. Fastest total completion time (lower ms)
 * 2. Fewest hints
 * 3. Fewest failed attempts
 * 4. Sudden-death admin order (lower suddenDeathRank wins; missing = Infinity)
 */

function compareTeamsForLeaderboard(a, b) {
  const scoreA = Number(a.finalScore ?? a.currentScore ?? 0);
  const scoreB = Number(b.finalScore ?? b.currentScore ?? 0);
  if (scoreB !== scoreA) return scoreB - scoreA;

  const completionMs = (team) => {
    const n = Number(team.stats?.totalCompletionMs);
    // 0 is "never finished" (Start over), not the fastest time
    if (!Number.isFinite(n) || n <= 0) return Number.POSITIVE_INFINITY;
    return n;
  };
  const timeA = completionMs(a);
  const timeB = completionMs(b);
  if (timeA !== timeB) return timeA - timeB;

  const hintsA = Number(a.stats?.hintsUsed ?? 0);
  const hintsB = Number(b.stats?.hintsUsed ?? 0);
  if (hintsA !== hintsB) return hintsA - hintsB;

  const failsA = Number(a.stats?.failedAttempts ?? 0);
  const failsB = Number(b.stats?.failedAttempts ?? 0);
  if (failsA !== failsB) return failsA - failsB;

  const sdA = a.suddenDeathRank == null ? Number.POSITIVE_INFINITY : Number(a.suddenDeathRank);
  const sdB = b.suddenDeathRank == null ? Number.POSITIVE_INFINITY : Number(b.suddenDeathRank);
  if (sdA !== sdB) return sdA - sdB;

  // Stable fallback: teamCode
  return String(a.teamCode || '').localeCompare(String(b.teamCode || ''));
}

/**
 * @param {object[]} teams
 * @param {{ topNDirectFinale?: number } | null} [qualification]
 */
function rankTeams(teams, qualification = null) {
  const topN = Math.max(1, Number(qualification?.topNDirectFinale) || 5);
  const sorted = [...teams].sort(compareTeamsForLeaderboard);
  return sorted.map((team, index) => ({
    rank: index + 1,
    team,
    // Top N go direct to Finale; remaining enter Survival Stage.
    qualification: index < topN ? 'DIRECT_FINALE' : 'SURVIVAL_STAGE',
  }));
}

module.exports = {
  compareTeamsForLeaderboard,
  rankTeams,
};
