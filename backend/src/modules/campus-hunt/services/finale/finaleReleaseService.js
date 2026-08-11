const CampusHuntFinaleEntry = require('../../models/CampusHuntFinaleEntry');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const CampusHuntStartingPoint = require('../../models/CampusHuntStartingPoint');
const { getFinaleRound, getOrCreateMissionConfig } = require('./finaleBootstrapService');
const { writeAudit } = require('../auditService');
const { FINALE_DEFAULTS } = require('../../constants');

const DEFAULT_MEET_LOCATIONS = [
  { code: 'A', name: 'Library' },
  { code: 'B', name: 'Chanakya Porch' },
  { code: 'C', name: 'Design' },
  { code: 'D', name: 'Vyas Parking' },
];

function releaseError(message, code, status = 409) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function sortFinalistEntries(entries) {
  const direct = entries
    .filter((e) => e.promotionSource === 'direct_r1')
    .sort((a, b) => (a.r1Rank ?? 9999) - (b.r1Rank ?? 9999));
  const manual = entries
    .filter((e) => e.promotionSource === 'manual_pick')
    .sort((a, b) => (a.r1Rank ?? 9999) - (b.r1Rank ?? 9999));
  return [...direct, ...manual];
}

async function resolveMeetLocations(eventId) {
  const starts = await CampusHuntStartingPoint.find({ eventId, active: true })
    .sort({ code: 1 })
    .lean();
  if (starts.length >= 4) {
    return starts.slice(0, 4).map((s, index) => ({
      code: String(s.code || DEFAULT_MEET_LOCATIONS[index].code).toUpperCase(),
      name: s.name || DEFAULT_MEET_LOCATIONS[index].name,
      startingPointId: String(s._id),
    }));
  }
  return DEFAULT_MEET_LOCATIONS.map((loc) => ({ ...loc }));
}

/**
 * 4 meet locations × 3 waves.
 * Wave 1 (t0): one team at each location (4 teams)
 * Wave 2 (t+interval): next 4
 * Wave 3 (t+2*interval): last 4
 */
function buildReleaseAssignments({
  entries,
  meetLocations,
  startsAt,
  releaseIntervalMinutes,
}) {
  const sorted = sortFinalistEntries(entries).slice(0, FINALE_DEFAULTS.maxFinalists);
  const intervalMs = Math.max(1, Number(releaseIntervalMinutes) || 5) * 60 * 1000;
  const base = new Date(startsAt);
  const locations = meetLocations.slice(0, 4);
  const assignments = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const wave = Math.floor(i / locations.length); // 0,1,2
    const locIndex = i % locations.length;
    const loc = locations[locIndex];
    const slot = i + 1;
    assignments.push({
      entryId: String(sorted[i]._id),
      teamId: String(sorted[i].teamId),
      finaleSlot: slot,
      finaleSlotLabel: `Team ${slot}`,
      releaseWave: wave + 1,
      meetLocationCode: loc.code,
      meetLocationName: loc.name,
      scheduledStartAt: new Date(base.getTime() + wave * intervalMs),
      promotionSource: sorted[i].promotionSource,
    });
  }

  return {
    startsAt: base,
    releaseIntervalMinutes: Number(releaseIntervalMinutes) || 5,
    meetLocations: locations,
    assignments,
    waves: 3,
    teamsPerWave: locations.length,
  };
}

async function loadEntriesWithTeams(eventId) {
  const entries = await CampusHuntFinaleEntry.find({ eventId }).lean();
  const teamIds = entries.map((e) => e.teamId);
  const teams = await CampusHuntTeam.find({ _id: { $in: teamIds } })
    .select('teamCode teamName')
    .lean();
  const teamById = new Map(teams.map((t) => [String(t._id), t]));
  return entries.map((e) => ({
    ...e,
    teamCode: teamById.get(String(e.teamId))?.teamCode,
    teamName: teamById.get(String(e.teamId))?.teamName,
  }));
}

async function previewFinaleSchedule({
  eventId,
  startsAt,
  releaseIntervalMinutes = 5,
}) {
  const round = await getFinaleRound(eventId);
  if (!round) throw releaseError('Bootstrap Finale first.', 'FINALE_NOT_BOOTSTRAPPED');
  if (!startsAt) throw releaseError('startsAt is required.', 'MISSING_STARTS_AT', 400);

  const entries = await loadEntriesWithTeams(eventId);
  if (entries.length < FINALE_DEFAULTS.maxFinalists) {
    throw releaseError(
      `Need ${FINALE_DEFAULTS.maxFinalists} finalists before scheduling (have ${entries.length}).`,
      'NEED_FINALISTS',
    );
  }

  const meetLocations = await resolveMeetLocations(eventId);
  const plan = buildReleaseAssignments({
    entries,
    meetLocations,
    startsAt,
    releaseIntervalMinutes,
  });

  const byTeam = new Map(entries.map((e) => [String(e._id), e]));
  return {
    ...plan,
    scheduleStatus: round.scheduleStatus || 'draft',
    assignments: plan.assignments.map((row) => {
      const entry = byTeam.get(row.entryId);
      return {
        ...row,
        teamCode: entry?.teamCode,
        teamName: entry?.teamName,
      };
    }),
  };
}

async function generateFinaleSchedule({
  eventId,
  startsAt,
  releaseIntervalMinutes = 5,
  actor = {},
}) {
  const preview = await previewFinaleSchedule({ eventId, startsAt, releaseIntervalMinutes });
  const round = await getFinaleRound(eventId);
  if (round.scheduleStatus === 'locked' && round.status === 'live') {
    throw releaseError('Cannot regenerate while Finale is live with a locked schedule.', 'SCHEDULE_LOCKED');
  }

  for (const row of preview.assignments) {
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntFinaleEntry.updateOne(
      { _id: row.entryId },
      {
        $set: {
          finaleSlot: row.finaleSlot,
          meetLocationCode: row.meetLocationCode,
          meetLocationName: row.meetLocationName,
          scheduledStartAt: row.scheduledStartAt,
          releaseWave: row.releaseWave,
        },
        $unset: { releasedAt: 1 },
      },
    );
  }

  round.releaseIntervalMinutes = preview.releaseIntervalMinutes;
  round.startsAt = preview.startsAt;
  round.scheduleStatus = 'draft';
  round.scheduleLockedAt = undefined;
  await round.save();

  const config = await getOrCreateMissionConfig(eventId, round._id);
  config.markModified('intelHunt');
  if (!config.finaleRelease) config.finaleRelease = {};
  config.finaleRelease = {
    meetLocations: preview.meetLocations,
    pausedMeetCodes: [],
    releaseIntervalMinutes: preview.releaseIntervalMinutes,
  };
  config.markModified('finaleRelease');
  await config.save();

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_schedule_generated',
    targetType: 'round',
    targetId: round._id,
    after: {
      startsAt: preview.startsAt,
      teams: preview.assignments.length,
      interval: preview.releaseIntervalMinutes,
    },
  });

  return preview;
}

async function lockFinaleSchedule({ eventId, actor = {} }) {
  const round = await getFinaleRound(eventId);
  if (!round) throw releaseError('Bootstrap Finale first.', 'FINALE_NOT_BOOTSTRAPPED');

  const missing = await CampusHuntFinaleEntry.countDocuments({
    eventId,
    $or: [
      { scheduledStartAt: { $exists: false } },
      { scheduledStartAt: null },
      { meetLocationCode: { $in: [null, ''] } },
    ],
  });
  if (missing > 0) {
    throw releaseError('Generate the release schedule first.', 'SCHEDULE_NOT_GENERATED');
  }

  round.scheduleStatus = 'locked';
  round.scheduleLockedAt = new Date();
  await round.save();

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_schedule_locked',
    targetType: 'round',
    targetId: round._id,
  });

  return { round, scheduleStatus: 'locked' };
}

function isEntryReleased(entry, round, config, now = new Date()) {
  if (entry.releasedAt) return true;
  if (round?.status !== 'live') return false;
  if (round.releasesPaused) return false;
  const paused = config?.finaleRelease?.pausedMeetCodes || [];
  if (entry.meetLocationCode && paused.includes(entry.meetLocationCode)) return false;
  if (!entry.scheduledStartAt) return false;
  return new Date(entry.scheduledStartAt).getTime() <= now.getTime();
}

async function releaseDueFinaleTeams({ eventId, actor = {} }) {
  const round = await getFinaleRound(eventId);
  if (!round || round.status !== 'live') {
    return { released: 0, entries: [] };
  }
  if (round.releasesPaused) {
    return { released: 0, paused: true, entries: [] };
  }

  const config = await getOrCreateMissionConfig(eventId, round._id);
  const paused = new Set(config?.finaleRelease?.pausedMeetCodes || []);
  const now = new Date();

  const due = await CampusHuntFinaleEntry.find({
    eventId,
    releasedAt: { $in: [null, undefined] },
    scheduledStartAt: { $lte: now },
    status: { $in: ['eligible', 'playing'] },
  });

  const released = [];
  for (const entry of due) {
    if (entry.meetLocationCode && paused.has(entry.meetLocationCode)) continue;
    entry.releasedAt = now;
    if (entry.status === 'eligible') entry.status = 'playing';
    // eslint-disable-next-line no-await-in-loop
    await entry.save();
    released.push(String(entry.teamId));
  }

  if (released.length) {
    await writeAudit({
      eventId,
      ...actor,
      action: 'finale_auto_release',
      targetType: 'event',
      targetId: eventId,
      after: { count: released.length, teamIds: released },
    });
  }

  return { released: released.length, entries: released };
}

async function releaseFinaleTeam({ eventId, teamId, actor = {} }) {
  const round = await getFinaleRound(eventId);
  if (!round || round.status !== 'live') {
    throw releaseError('Finale must be live to release a team.', 'FINALE_NOT_LIVE');
  }
  const entry = await CampusHuntFinaleEntry.findOne({ eventId, teamId });
  if (!entry) throw releaseError('Finale entry not found.', 'NOT_FOUND', 404);

  entry.releasedAt = new Date();
  if (entry.status === 'eligible') entry.status = 'playing';
  await entry.save();

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_manual_release',
    targetType: 'team',
    targetId: teamId,
  });

  return entry;
}

async function setFinaleReleasesPaused({ eventId, paused, actor = {} }) {
  const round = await getFinaleRound(eventId);
  if (!round) throw releaseError('Bootstrap Finale first.', 'FINALE_NOT_BOOTSTRAPPED');
  round.releasesPaused = Boolean(paused);
  await round.save();
  await writeAudit({
    eventId,
    ...actor,
    action: paused ? 'finale_releases_paused' : 'finale_releases_resumed',
    targetType: 'round',
    targetId: round._id,
  });
  return round;
}

async function setFinaleMeetLocationPaused({ eventId, meetLocationCode, paused, actor = {} }) {
  const round = await getFinaleRound(eventId);
  if (!round) throw releaseError('Bootstrap Finale first.', 'FINALE_NOT_BOOTSTRAPPED');
  const config = await getOrCreateMissionConfig(eventId, round._id);
  const code = String(meetLocationCode || '').toUpperCase();
  if (!config.finaleRelease) config.finaleRelease = { pausedMeetCodes: [] };
  const set = new Set(config.finaleRelease.pausedMeetCodes || []);
  if (paused) set.add(code);
  else set.delete(code);
  config.finaleRelease.pausedMeetCodes = [...set];
  config.markModified('finaleRelease');
  await config.save();

  await writeAudit({
    eventId,
    ...actor,
    action: paused ? 'finale_meet_paused' : 'finale_meet_resumed',
    targetType: 'meet_location',
    targetId: code,
  });

  return { pausedMeetCodes: config.finaleRelease.pausedMeetCodes };
}

async function getFinaleLiveDashboard(eventId) {
  const round = await getFinaleRound(eventId);
  if (!round) throw releaseError('Bootstrap Finale first.', 'FINALE_NOT_BOOTSTRAPPED');

  if (round.status === 'live') {
    await releaseDueFinaleTeams({ eventId, actor: { actorType: 'system', actorId: 'auto' } });
  }

  const config = await getOrCreateMissionConfig(eventId, round._id);
  const entries = await loadEntriesWithTeams(eventId);
  const sorted = sortFinalistEntries(entries);
  const pausedMeetCodes = config?.finaleRelease?.pausedMeetCodes || [];
  const meetLocations = config?.finaleRelease?.meetLocations?.length
    ? config.finaleRelease.meetLocations
    : await resolveMeetLocations(eventId);

  const now = new Date();
  const teams = sorted.map((e, index) => {
    const released = Boolean(e.releasedAt)
      || isEntryReleased(e, round, config, now);
    return {
      entryId: String(e._id),
      teamId: String(e.teamId),
      teamCode: e.teamCode,
      teamName: e.teamName,
      finaleSlot: e.finaleSlot || index + 1,
      finaleSlotLabel: `Team ${e.finaleSlot || index + 1}`,
      meetLocationCode: e.meetLocationCode,
      meetLocationName: e.meetLocationName,
      scheduledStartAt: e.scheduledStartAt,
      releasedAt: e.releasedAt,
      releaseWave: e.releaseWave,
      status: e.status,
      finaleScore: e.finaleScore,
      released,
      waiting: round.status === 'live' && !released && e.status !== 'locked' && e.status !== 'stopped',
      locationPaused: pausedMeetCodes.includes(e.meetLocationCode),
    };
  });

  const byLocation = meetLocations.map((loc) => {
    const locTeams = teams.filter((t) => t.meetLocationCode === loc.code);
    return {
      ...loc,
      paused: pausedMeetCodes.includes(loc.code),
      waiting: locTeams.filter((t) => t.waiting).length,
      released: locTeams.filter((t) => t.released).length,
      total: locTeams.length,
      teams: locTeams,
    };
  });

  return {
    round: {
      id: String(round._id),
      status: round.status,
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      scheduleStatus: round.scheduleStatus,
      releasesPaused: Boolean(round.releasesPaused),
      releaseIntervalMinutes: round.releaseIntervalMinutes || 5,
    },
    counts: {
      total: teams.length,
      waiting: teams.filter((t) => t.waiting).length,
      released: teams.filter((t) => t.released).length,
      playing: teams.filter((t) => t.status === 'playing').length,
    },
    meetLocations: byLocation,
    teams,
    serverTime: now.toISOString(),
  };
}

module.exports = {
  DEFAULT_MEET_LOCATIONS,
  previewFinaleSchedule,
  generateFinaleSchedule,
  lockFinaleSchedule,
  releaseDueFinaleTeams,
  releaseFinaleTeam,
  setFinaleReleasesPaused,
  setFinaleMeetLocationPaused,
  getFinaleLiveDashboard,
  isEntryReleased,
  buildReleaseAssignments,
  resolveMeetLocations,
};
