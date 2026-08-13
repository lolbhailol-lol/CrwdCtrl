const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntEvent = require('../models/CampusHuntEvent');
const { rankTeams } = require('../utils/tieBreakers');

function sortByTeamCode(teams) {
  return [...teams].sort((a, b) => String(a.teamCode || '').localeCompare(
    String(b.teamCode || ''),
    undefined,
    { numeric: true, sensitivity: 'base' },
  ));
}

/**
 * Live / public leaderboard for an event.
 * Only includes the competition field (teamCapacity), not leftover demo teams.
 */
async function buildLeaderboard(eventId, { includeUnfinished = true } = {}) {
  const query = { eventId };
  if (!includeUnfinished) {
    query.currentStage = 'SCORE_LOCKED';
  }

  const [teams, round, event] = await Promise.all([
    CampusHuntTeam.find(query)
      .select(
        'teamCode teamName currentScore finalScore currentStage startStatus scheduledStartAt actualStartAt finishedAt stats suddenDeathRank routeId status scoreLockedAt roundId',
      )
      .lean(),
    CampusHuntRound.findOne({ eventId, roundNumber: 1 }).select('qualification _id').lean(),
    CampusHuntEvent.findById(eventId).select('teamCapacity').lean(),
  ]);

  const capacity = Math.max(1, Number(event?.teamCapacity) || teams.length || 40);

  // Drop parked leftovers (CANCELLED), then keep first N by team code — same rule as schedule.
  const eligible = teams.filter((team) => String(team.startStatus || '') !== 'CANCELLED');
  const inRound = round?._id
    ? eligible.filter((team) => team.roundId && String(team.roundId) === String(round._id))
    : [];
  const pool = sortByTeamCode(inRound.length ? inRound : eligible).slice(0, capacity);

  const ranked = rankTeams(pool, round?.qualification);
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
