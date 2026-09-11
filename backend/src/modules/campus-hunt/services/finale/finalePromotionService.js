const CampusHuntRound = require('../../models/CampusHuntRound');
const CampusHuntFinaleEntry = require('../../models/CampusHuntFinaleEntry');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const CampusHuntEvent = require('../../models/CampusHuntEvent');
const { buildLeaderboard } = require('../leaderboardService');
const { getFinaleRound, getOrCreateMissionConfig } = require('./finaleBootstrapService');
const { FINALE_DEFAULTS } = require('../../constants');
const { deriveCompetitionFormat } = require('../../utils/competitionFormat');
const { writeAudit } = require('../auditService');

function promotionError(message, code, status = 409) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

async function resolvePromotionCaps(eventId) {
  const [r1, finaleRound, event] = await Promise.all([
    CampusHuntRound.findOne({ eventId, roundNumber: 1 }).lean(),
    getFinaleRound(eventId),
    CampusHuntEvent.findById(eventId)
      .select('teamCapacity teamSize finaleCapacity finaleDirectFromR1')
      .lean(),
  ]);
  const q = r1?.qualification || finaleRound?.qualification || {};
  const format = deriveCompetitionFormat({
    teamCapacity: event?.teamCapacity,
    teamSize: event?.teamSize,
    directFromR1: event?.finaleDirectFromR1 ?? q.topNDirectFinale,
    finaleTeams: event?.finaleCapacity ?? q.finaleTeams,
  });
  return {
    maxFinalists: format.finaleTeams || FINALE_DEFAULTS.maxFinalists,
    directFromR1: format.directFromR1 || FINALE_DEFAULTS.directFromR1,
    manualPick: format.manualPick != null ? format.manualPick : FINALE_DEFAULTS.manualPick,
    format,
    r1,
    finaleRound,
  };
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
  maxFinalists = FINALE_DEFAULTS.maxFinalists,
}) {
  const existing = await CampusHuntFinaleEntry.findOne({ eventId, teamId: team._id });
  if (existing) return existing;

  const count = await CampusHuntFinaleEntry.countDocuments({ eventId });
  if (count >= maxFinalists) {
    throw promotionError(`Finale already has ${maxFinalists} teams.`, 'FINALE_FULL');
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
  const caps = await resolvePromotionCaps(eventId);
  const finaleRound = caps.finaleRound;
  if (!finaleRound) {
    throw promotionError('Bootstrap Finale round first.', 'FINALE_NOT_BOOTSTRAPPED');
  }
  const config = await getOrCreateMissionConfig(eventId, finaleRound._id);
  const leaderboard = await buildLeaderboard(eventId, { includeUnfinished: false });
  const topDirect = leaderboard
    .filter((row) => row.qualification === 'DIRECT_FINALE')
    .slice(0, caps.directFromR1);
  if (topDirect.length < caps.directFromR1) {
    throw promotionError(
      `Need at least ${caps.directFromR1} direct-finale teams on the R1 leaderboard.`,
      'INSUFFICIENT_DIRECT',
    );
  }

  const created = [];
  for (const row of topDirect) {
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
      maxFinalists: caps.maxFinalists,
    });
    created.push(entry);
  }

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_promote_auto',
    targetType: 'event',
    targetId: eventId,
    after: { count: created.length, directFromR1: caps.directFromR1 },
  });

  return { promoted: created.length, entries: created };
}

async function promoteManualPick({ eventId, teamIds = [], actor = {} }) {
  await assertR1Finalized(eventId);
  const caps = await resolvePromotionCaps(eventId);
  const finaleRound = caps.finaleRound;
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

  if (directCount < caps.directFromR1) {
    throw promotionError(
      `Run auto-promote for top ${caps.directFromR1} first.`,
      'DIRECT_NOT_DONE',
    );
  }

  const ids = [...new Set(teamIds.map(String))];
  if (ids.length === 0) {
    throw promotionError('Select at least one team.', 'NO_TEAMS', 400);
  }
  if (manualCount + ids.length > caps.manualPick) {
    throw promotionError(
      `Manual pick allows ${caps.manualPick} teams (${manualCount} already picked).`,
      'MANUAL_CAP',
    );
  }
  if (total + ids.length > caps.maxFinalists) {
    throw promotionError(`Would exceed ${caps.maxFinalists} finale teams.`, 'FINALE_FULL');
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
      maxFinalists: caps.maxFinalists,
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
 * Demo pilot — promote first N teams as finalists without R1 finalize requirement.
 * First directFromR1 = direct_r1, remainder = manual_pick.
 */
async function promoteDemoFinalists({ eventId, actor = {} }) {
  const caps = await resolvePromotionCaps(eventId);
  const finaleRound = caps.finaleRound;
  if (!finaleRound) {
    throw promotionError('Bootstrap Finale round first.', 'FINALE_NOT_BOOTSTRAPPED');
  }
  const config = await getOrCreateMissionConfig(eventId, finaleRound._id);

  const teams = await CampusHuntTeam.find({ eventId })
    .sort({ teamCode: 1 })
    .limit(caps.maxFinalists);

  if (teams.length < caps.maxFinalists) {
    throw promotionError(
      `Need ${caps.maxFinalists} teams for demo finale. Found ${teams.length}. Create demo teams first.`,
      'INSUFFICIENT_TEAMS',
    );
  }

  const created = [];
  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    const promotionSource = i < caps.directFromR1 ? 'direct_r1' : 'manual_pick';
    // eslint-disable-next-line no-await-in-loop
    const entry = await createEntry({
      eventId,
      roundId: finaleRound._id,
      team,
      promotionSource,
      r1Rank: i + 1,
      r1Score: Math.max(100, 900 - i * 25),
      startingScore: config.startingScore,
      maxFinalists: caps.maxFinalists,
    });
    if (entry) created.push(entry);
  }

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_promote_demo',
    targetType: 'event',
    targetId: eventId,
    after: { count: created.length, maxFinalists: caps.maxFinalists },
  });

  return { promoted: created.length, entries: created };
}

/**
 * Demo / dry-run: set exactly these teams as the finale roster.
 * No Round 1 finalize required. Replaces existing finalists when replace=true.
 * Mission board / schedule use this entry list after you Generate schedule.
 */
async function setFinalePlayingTeams({
  eventId,
  teamIds = [],
  replace = true,
  actor = {},
}) {
  const finaleRound = await getFinaleRound(eventId);
  if (!finaleRound) {
    throw promotionError('Bootstrap Finale round first.', 'FINALE_NOT_BOOTSTRAPPED');
  }
  const config = await getOrCreateMissionConfig(eventId, finaleRound._id);
  const caps = await resolvePromotionCaps(eventId);

  const ids = [...new Set((teamIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) {
    throw promotionError('Select at least one team to play Finale.', 'NO_TEAMS', 400);
  }
  if (ids.length > 40) {
    throw promotionError('Select at most 40 teams.', 'TOO_MANY', 400);
  }

  if (replace) {
    const existing = await CampusHuntFinaleEntry.find({ eventId });
    for (const entry of existing) {
      if (ids.includes(String(entry.teamId))) continue;
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntTeam.updateOne(
        { _id: entry.teamId },
        {
          $unset: { finaleEntryId: 1 },
          $set: { competitionPhase: 'round1' },
        },
      );
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntFinaleEntry.deleteOne({ _id: entry._id });
    }
  }

  const created = [];
  const directN = Math.min(caps.directFromR1 || 0, ids.length);
  for (let i = 0; i < ids.length; i += 1) {
    const teamId = ids[i];
    // eslint-disable-next-line no-await-in-loop
    const team = await CampusHuntTeam.findOne({ _id: teamId, eventId });
    if (!team) {
      throw promotionError(`Team not found: ${teamId}`, 'TEAM_NOT_FOUND', 404);
    }
    const promotionSource = i < directN ? 'direct_r1' : 'manual_pick';
    // eslint-disable-next-line no-await-in-loop
    const entry = await createEntry({
      eventId,
      roundId: finaleRound._id,
      team,
      promotionSource,
      r1Rank: i + 1,
      r1Score: Number(team.currentScore) || 0,
      startingScore: config.startingScore,
      maxFinalists: ids.length,
    });
    created.push(entry);
  }

  // Keep event capacity aligned so schedule/UI expect this many finalists
  const event = await CampusHuntEvent.findById(eventId);
  if (event) {
    event.finaleCapacity = ids.length;
    await event.save();
  }

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_set_playing_teams',
    targetType: 'event',
    targetId: eventId,
    after: { count: created.length, teamIds: ids, replace: Boolean(replace) },
  });

  return {
    promoted: created.length,
    entries: created,
    finaleCapacity: ids.length,
    message: `${created.length} team(s) set for Finale — Generate schedule next so missions/slots update.`,
  };
}

module.exports = {
  resolvePromotionCaps,
  promoteTop5FromR1,
  promoteManualPick,
  promoteDemoFinalists,
  setFinalePlayingTeams,
  listEntries,
  listPromotionCandidates,
};
