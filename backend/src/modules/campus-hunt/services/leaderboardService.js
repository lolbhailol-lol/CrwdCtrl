const CampusHuntTeam = require('../models/CampusHuntTeam');
const { rankTeams } = require('../utils/tieBreakers');

async function buildLeaderboard(eventId, { includeUnfinished = true } = {}) {
  const query = { eventId };
  if (!includeUnfinished) {
    query.currentStage = 'SCORE_LOCKED';
  }

  const teams = await CampusHuntTeam.find(query)
    .select(
      'teamCode teamName currentScore finalScore currentStage startStatus scheduledStartAt actualStartAt finishedAt stats suddenDeathRank routeId status scoreLockedAt',
    )
    .lean();

  const ranked = rankTeams(teams);
  return ranked.map((row) => ({
    rank: row.rank,
    teamId: String(row.team._id),
    teamCode: row.team.teamCode,
    teamName: row.team.teamName,
    score: row.team.finalScore ?? row.team.currentScore,
    currentStage: row.team.currentStage,
    startStatus: row.team.startStatus,
    scheduledStartAt: row.team.scheduledStartAt,
    actualStartAt: row.team.actualStartAt,
    finishedAt: row.team.finishedAt,
    hintsUsed: row.team.stats?.hintsUsed || 0,
    failedAttempts: row.team.stats?.failedAttempts || 0,
    totalCompletionMs: row.team.stats?.totalCompletionMs ?? null,
    qualification: row.qualification,
    status: row.team.status,
  }));
}

module.exports = {
  buildLeaderboard,
};
