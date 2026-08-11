const CampusHuntRound = require('../../models/CampusHuntRound');
const CampusHuntFinaleEntry = require('../../models/CampusHuntFinaleEntry');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const { buildLeaderboard } = require('../leaderboardService');
const { getFinaleRound, getOrCreateMissionConfig } = require('./finaleBootstrapService');
const { FINALE_DEFAULTS } = require('../../constants');
const { writeAudit } = require('../auditService');

function promotionError(message, code, status = 409) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

async function assertR1Finalized(eventId) {
  const r1 = await CampusHuntRound.findOne({ eventId, roundNumber: 1 });
  if (!r1 || r1.status !== 'finalized') {
    throw promotionError('Round 1 must be finalized before promoting finalists.', 'R1_NOT_FINALIZED');
  }
  return r1;
}

async function createEntry({
  eventId,
  roundId,
  team,
  promotionSource,
  r1Rank,
  r1Score,
  startingScore,
}) {
  const existing = await CampusHuntFinaleEntry.findOne({ eventId, teamId: team._id });
  if (existing) return existing;

  const count = await CampusHuntFinaleEntry.countDocuments({ eventId });
  if (count >= FINALE_DEFAULTS.maxFinalists) {
    throw promotionError('Finale already has 12 teams.', 'FINALE_FULL');
  }

  const entry = await CampusHuntFinaleEntry.create({
    eventId,
    roundId,
    teamId: team._id,
    promotionSource,
    r1Rank,
    r1Score,
    finaleScore: startingScore,
    status: 'eligible',
    completedMissionIds: [],
  });

  team.competitionPhase = 'finale';
  team.finaleEntryId = entry._id;
  await team.save();

  return entry;
}

async function promoteTop5FromR1({ eventId, actor = {} }) {
  await assertR1Finalized(eventId);
  const finaleRound = await getFinaleRound(eventId);
  if (!finaleRound) {
    throw promotionError('Bootstrap Finale round first.', 'FINALE_NOT_BOOTSTRAPPED');
  }
  const config = await getOrCreateMissionConfig(eventId, finaleRound._id);
  const leaderboard = await buildLeaderboard(eventId, { includeUnfinished: false });
  const top5 = leaderboard.filter((row) => row.qualification === 'DIRECT_FINALE').slice(0, 5);
  if (top5.length < FINALE_DEFAULTS.directFromR1) {
    throw promotionError(
      `Need at least ${FINALE_DEFAULTS.directFromR1} direct-finale teams on the R1 leaderboard.`,
      'INSUFFICIENT_DIRECT',
    );
  }

  const created = [];
  for (const row of top5) {
    const team = await CampusHuntTeam.findById(row.teamId);
    if (!team) continue;
    // eslint-disable-next-line no-await-in-loop
    const entry = await createEntry({
      eventId,
      roundId: finaleRound._id,
      team,
      promotionSource: 'direct_r1',
      r1Rank: row.rank,
      r1Score: row.score,
      startingScore: config.startingScore,
    });
    created.push(entry);
  }

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_promote_auto',
    targetType: 'event',
    targetId: eventId,
    after: { count: created.length },
  });

  return { promoted: created.length, entries: created };
}

async function promoteManualPick({ eventId, teamIds = [], actor = {} }) {
  await assertR1Finalized(eventId);
  const finaleRound = await getFinaleRound(eventId);
  if (!finaleRound) {
    throw promotionError('Bootstrap Finale round first.', 'FINALE_NOT_BOOTSTRAPPED');
  }
  const config = await getOrCreateMissionConfig(eventId, finaleRound._id);

  const directCount = await CampusHuntFinaleEntry.countDocuments({
    eventId,
    promotionSource: 'direct_r1',
  });
  const manualCount = await CampusHuntFinaleEntry.countDocuments({
    eventId,
    promotionSource: 'manual_pick',
  });
  const total = await CampusHuntFinaleEntry.countDocuments({ eventId });

  if (directCount < FINALE_DEFAULTS.directFromR1) {
    throw promotionError('Run auto-promote for top 5 first.', 'DIRECT_NOT_DONE');
  }

  const ids = [...new Set(teamIds.map(String))];
  if (ids.length === 0) {
    throw promotionError('Select at least one team.', 'NO_TEAMS', 400);
  }
  if (manualCount + ids.length > FINALE_DEFAULTS.manualPick) {
    throw promotionError(
      `Manual pick allows ${FINALE_DEFAULTS.manualPick} teams (${manualCount} already picked).`,
      'MANUAL_CAP',
    );
  }
  if (total + ids.length > FINALE_DEFAULTS.maxFinalists) {
    throw promotionError('Would exceed 12 finale teams.', 'FINALE_FULL');
  }

  const leaderboard = await buildLeaderboard(eventId, { includeUnfinished: true });
  const rankByTeam = new Map(leaderboard.map((r) => [r.teamId, r]));

  const created = [];
  for (const teamId of ids) {
    const row = rankByTeam.get(teamId);
    if (row?.qualification === 'DIRECT_FINALE') {
      throw promotionError(
        `Team ${row.teamCode} is already a direct finalist.`,
        'ALREADY_DIRECT',
      );
    }
    const team = await CampusHuntTeam.findOne({ _id: teamId, eventId });
    if (!team) {
      throw promotionError('Team not found for this event.', 'TEAM_NOT_FOUND', 404);
    }
    // eslint-disable-next-line no-await-in-loop
    const entry = await createEntry({
      eventId,
      roundId: finaleRound._id,
      team,
      promotionSource: 'manual_pick',
      r1Rank: row?.rank,
      r1Score: row?.score,
      startingScore: config.startingScore,
    });
    created.push(entry);
  }

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_promote_manual',
    targetType: 'event',
    targetId: eventId,
    after: { count: created.length, teamIds: ids },
  });

  return { promoted: created.length, entries: created };
}

async function listEntries(eventId) {
  const entries = await CampusHuntFinaleEntry.find({ eventId })
    .sort({ finaleScore: -1, createdAt: 1 })
    .lean();
  const teamIds = entries.map((e) => e.teamId);
  const teams = await CampusHuntTeam.find({ _id: { $in: teamIds } })
    .select('teamCode teamName leaderName memberNames')
    .lean();
  const teamById = new Map(teams.map((t) => [String(t._id), t]));

  return entries.map((entry, index) => {
    const team = teamById.get(String(entry.teamId));
    return {
      ...entry,
      id: String(entry._id),
      rank: index + 1,
      teamCode: team?.teamCode,
      teamName: team?.teamName,
    };
  });
}

async function listPromotionCandidates(eventId) {
  const leaderboard = await buildLeaderboard(eventId, { includeUnfinished: true });
  const entries = await CampusHuntFinaleEntry.find({ eventId }).select('teamId').lean();
  const inFinale = new Set(entries.map((e) => String(e.teamId)));

  return leaderboard.map((row) => ({
    ...row,
    inFinale: inFinale.has(row.teamId),
    selectable: row.qualification !== 'DIRECT_FINALE' && !inFinale.has(row.teamId),
  }));
}

/**
 * Demo pilot — promote CC001–CC012 as finalists without R1 finalize requirement.
 * Team 1–5 = direct_r1, Team 6–12 = manual_pick.
 */
async function promoteDemoFinalists({ eventId, actor = {} }) {
  const finaleRound = await getFinaleRound(eventId);
  if (!finaleRound) {
    throw promotionError('Bootstrap Finale round first.', 'FINALE_NOT_BOOTSTRAPPED');
  }
  const config = await getOrCreateMissionConfig(eventId, finaleRound._id);

  const teams = await CampusHuntTeam.find({ eventId })
    .sort({ teamCode: 1 })
    .limit(FINALE_DEFAULTS.maxFinalists);

  if (teams.length < FINALE_DEFAULTS.maxFinalists) {
    throw promotionError(
      `Need ${FINALE_DEFAULTS.maxFinalists} teams (CC001–CC012). Found ${teams.length}. Create demo teams first.`,
      'INSUFFICIENT_TEAMS',
    );
  }

  const created = [];
  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    const promotionSource = i < FINALE_DEFAULTS.directFromR1 ? 'direct_r1' : 'manual_pick';
    // eslint-disable-next-line no-await-in-loop
    const entry = await createEntry({
      eventId,
      roundId: finaleRound._id,
      team,
      promotionSource,
      r1Rank: i + 1,
      r1Score: Math.max(100, 900 - i * 25),
      startingScore: config.startingScore,
    });
    if (entry) created.push(entry);
  }

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_promote_demo',
    targetType: 'event',
    targetId: eventId,
    after: { count: created.length },
  });

  return { promoted: created.length, entries: created };
}

module.exports = {
  promoteTop5FromR1,
  promoteManualPick,
  promoteDemoFinalists,
  listEntries,
  listPromotionCandidates,
};
