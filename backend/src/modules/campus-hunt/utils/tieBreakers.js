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

  const timeA = Number(a.stats?.totalCompletionMs ?? Number.POSITIVE_INFINITY);
  const timeB = Number(b.stats?.totalCompletionMs ?? Number.POSITIVE_INFINITY);
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

function rankTeams(teams) {
  const sorted = [...teams].sort(compareTeamsForLeaderboard);
  return sorted.map((team, index) => ({
    rank: index + 1,
    team,
    qualification: index < 8 ? 'GRAND_FINALE' : 'MAUT_KA_KUVA',
  }));
}

module.exports = {
  compareTeamsForLeaderboard,
  rankTeams,
};
