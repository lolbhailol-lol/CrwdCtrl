const CampusHuntFinaleMissionRun = require('../../models/CampusHuntFinaleMissionRun');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const { FINALE_DEFAULTS } = require('../../constants');
const { listEntries, resolvePromotionCaps } = require('./finalePromotionService');
const { getOrCreateMissionConfig } = require('./finaleBootstrapService');
const {
  getLocationPool,
  getLocationUsageCounts,
  buildCombinedAnswer,
} = require('./intelLocationService');
const { listGridSessionsForEvent } = require('../grid/gridSessionService');

function pickTwoLocationsForSlot(pool, slot) {
  if (!pool?.length) return [null, null];
  const base = (slot - 1) * 2;
  const loc1 = pool[base % pool.length];
  let loc2 = pool[(base + 1) % pool.length];
  if (loc2.id === loc1.id && pool.length > 1) {
    loc2 = pool[(base + 2) % pool.length];
  }
  return [loc1, loc2];
}

async function resolveFinaleTeamRows(eventId, entries) {
  const caps = await resolvePromotionCaps(eventId);
  if (entries.length >= caps.maxFinalists) {
    return sortEntriesForFinaleSlots(entries);
  }

  const teams = await CampusHuntTeam.find({ eventId })
    .sort({ teamCode: 1 })
    .limit(caps.maxFinalists)
    .select('teamCode teamName')
    .lean();

  const entryByTeamId = new Map(entries.map((e) => [String(e.teamId), e]));

  return teams.map((team, index) => {
    const slot = index + 1;
    const existing = entryByTeamId.get(String(team._id));
    if (existing) {
      return {
        ...existing,
        finaleSlot: slot,
        finaleSlotLabel: `Team ${slot}`,
      };
    }
    return {
      id: `demo-${team._id}`,
      teamId: team._id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      promotionSource: slot <= caps.directFromR1 ? 'direct_r1' : 'manual_pick',
      finaleScore: FINALE_DEFAULTS.startingScore,
      completedMissionIds: [],
      activeMissionId: null,
      status: 'eligible',
      r1Rank: slot,
      r1Score: Math.max(100, 900 - index * 25),
      finaleSlot: slot,
      finaleSlotLabel: `Team ${slot}`,
      isDemoRow: true,
    };
  });
}

function sortEntriesForFinaleSlots(entries) {
  const direct = entries
    .filter((e) => e.promotionSource === 'direct_r1')
    .sort((a, b) => (a.r1Rank ?? 9999) - (b.r1Rank ?? 9999));
  const manual = entries
    .filter((e) => e.promotionSource === 'manual_pick')
    .sort((a, b) => (a.r1Rank ?? 9999) - (b.r1Rank ?? 9999));
  return [...direct, ...manual].map((entry, index) => ({
    ...entry,
    finaleSlot: index + 1,
    finaleSlotLabel: `Team ${index + 1}`,
  }));
}

function intelStatusForEntry(entry, run) {
  if ((entry.completedMissionIds || []).includes('intel_hunt')) return 'completed';
  if (entry.activeMissionId === 'intel_hunt') return 'active';
  if (run?.status === 'completed') return 'completed';
  if (run?.status === 'active') return 'active';
  if (run?.status === 'abandoned') return 'abandoned';
  return 'not_started';
}

function deviceStatusForEntry(entry, run) {
  const done = entry.completedMissionIds || [];
  if (done.includes('field_terminal') || done.includes('borrowed_device')) return 'completed';
  if (entry.activeMissionId === 'field_terminal' || entry.activeMissionId === 'borrowed_device') {
    return 'active';
  }
  if (run?.status === 'completed') return 'completed';
  if (run?.status === 'active') return 'active';
  if (run?.status === 'abandoned') return 'abandoned';
  return 'not_started';
}

function lockboxStatusForEntry(entry, run) {
  const done = entry.completedMissionIds || [];
  if (done.includes('lockbox')) return 'completed';
  if (entry.activeMissionId === 'lockbox') return 'active';
  if (run?.status === 'completed') return 'completed';
  if (run?.status === 'active') return 'active';
  if (run?.status === 'abandoned') return 'abandoned';
  return 'not_started';
}

function blackoutStatusForEntry(entry, run) {
  const done = entry.completedMissionIds || [];
  if (done.includes('operation_blackout')) return 'completed';
  if (entry.activeMissionId === 'operation_blackout') return 'active';
  if (run?.status === 'completed') return 'completed';
  if (run?.status === 'active') return 'active';
  if (run?.status === 'abandoned') return 'abandoned';
  return 'not_started';
}

function mapIntelFromRun(run) {
  const assignment = run?.state?.assignment;
  if (!assignment?.location1 || !assignment?.location2) return null;
  return {
    step: run.state?.step || null,
    location1: {
      id: assignment.location1.id,
      name: assignment.location1.name,
      instruction: assignment.location1.instruction,
      fragment: assignment.location1.fragment
        || assignment.location1.acceptedAnswers?.[0]
        || '',
    },
    location2: {
      id: assignment.location2.id,
      name: assignment.location2.name,
      instruction: assignment.location2.instruction,
      fragment: assignment.location2.fragment
        || assignment.location2.acceptedAnswers?.[0]
        || '',
    },
    combinedAnswer: run.state?.combinedAnswer || assignment.combinedAnswer || '',
    assignedLocationIds: run.state?.assignedLocationIds || assignment.assignedLocationIds || [],
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    source: 'live',
  };
}

function mapIntelPreview(loc1, loc2) {
  return {
    step: null,
    location1: {
      id: loc1.id,
      name: loc1.name,
      instruction: loc1.instruction,
      fragment: loc1.fragment || loc1.acceptedAnswers?.[0] || '',
    },
    location2: {
      id: loc2.id,
      name: loc2.name,
      instruction: loc2.instruction,
      fragment: loc2.fragment || loc2.acceptedAnswers?.[0] || '',
    },
    combinedAnswer: buildCombinedAnswer(loc1, loc2),
    assignedLocationIds: [loc1.id, loc2.id],
    source: 'preview',
  };
}

function buildLocationUsageSummary(pool, usageCounts) {
  return pool.map((loc) => ({
    id: loc.id,
    name: loc.name,
    fragment: loc.fragment || loc.acceptedAnswers?.[0] || '',
    timesAssigned: usageCounts.get(loc.id) || 0,
  }));
}

async function listMissionAssignments(eventId) {
  const [entries, config, runs, gridSessions, usageCounts] = await Promise.all([
    listEntries(eventId),
    getOrCreateMissionConfig(eventId),
    CampusHuntFinaleMissionRun.find({ eventId }).sort({ createdAt: -1 }).lean(),
    listGridSessionsForEvent(eventId),
    getLocationUsageCounts(eventId),
  ]);

  const pool = getLocationPool(config);
  const sortedEntries = await resolveFinaleTeamRows(eventId, entries);

  const runByTeamMission = new Map();
  for (const run of runs) {
    const key = `${run.teamId}:${run.missionId}`;
    if (!runByTeamMission.has(key)) runByTeamMission.set(key, run);
  }

  const gridByTeamCode = new Map(gridSessions.map((s) => [s.teamCode, s]));

  const teams = sortedEntries.map((entry) => {
    const intelRun = runByTeamMission.get(`${entry.teamId}:intel_hunt`);
    const lockboxRun = runByTeamMission.get(`${entry.teamId}:lockbox`);
    const blackoutRun = runByTeamMission.get(`${entry.teamId}:operation_blackout`);
    const deviceRun = runByTeamMission.get(`${entry.teamId}:field_terminal`)
      || runByTeamMission.get(`${entry.teamId}:borrowed_device`);
    const grid = gridByTeamCode.get(entry.teamCode);

    const intelStatus = intelStatusForEntry(entry, intelRun);
    const lockboxStatus = lockboxStatusForEntry(entry, lockboxRun);
    const blackoutStatus = blackoutStatusForEntry(entry, blackoutRun);
    const deviceStatus = deviceStatusForEntry(entry, deviceRun);

    let intel = mapIntelFromRun(intelRun);
    if (!intel && intelStatus === 'not_started') {
      const [loc1, loc2] = pickTwoLocationsForSlot(pool, entry.finaleSlot);
      if (loc1 && loc2) {
        intel = mapIntelPreview(loc1, loc2);
      }
    }

    const lockbox = {
      status: lockboxStatus,
      step: lockboxRun?.state?.step || null,
      assignedKeyId: lockboxRun?.state?.assignedKeyId || null,
      assignedKeyLabel: lockboxRun?.state?.assignedKey?.label || null,
      attempts: lockboxRun?.state?.attempts || null,
      startedAt: lockboxRun?.startedAt || null,
      completedAt: lockboxRun?.completedAt || null,
    };

    const blackout = {
      status: blackoutStatus,
      step: blackoutRun?.state?.step || null,
      roleBySeat: blackoutRun?.state?.roleBySeat || null,
      accessToken: blackoutRun?.state?.accessToken || null,
      route: blackoutRun?.state?.route || null,
      frequency: blackoutRun?.state?.frequency || null,
      penaltiesIncurred: blackoutRun?.state?.penaltiesIncurred ?? null,
      attempts: blackoutRun?.state?.attempts || null,
      startedAt: blackoutRun?.startedAt || null,
      completedAt: blackoutRun?.completedAt || null,
    };

    const device = {
      status: deviceStatus,
      step: deviceRun?.state?.step || null,
      accessCode: deviceRun?.state?.accessCode || grid?.accessCode || null,
      grid: grid ? {
        status: grid.status,
        levelsCompleted: grid.levelsCompleted,
        totalLevels: grid.totalLevels,
        completionCode: grid.completionCode,
        completionCodeUsed: grid.completionCodeUsed,
      } : null,
      attempts: deviceRun?.state?.attempts ?? null,
      startedAt: deviceRun?.startedAt || null,
      completedAt: deviceRun?.completedAt || null,
    };

    return {
      finaleSlot: entry.finaleSlot,
      finaleSlotLabel: entry.finaleSlotLabel,
      teamId: entry.teamId,
      teamCode: entry.teamCode,
      teamName: entry.teamName,
      promotionSource: entry.promotionSource,
      isDemoRow: Boolean(entry.isDemoRow),
      finaleScore: entry.finaleScore,
      entryStatus: entry.status,
      activeMissionId: entry.activeMissionId,
      completedMissionIds: entry.completedMissionIds || [],
      intel: {
        status: intelStatus,
        ...(intel || {}),
      },
      lockbox,
      blackout,
      fieldTerminal: device,
      borrowedDevice: device, // legacy alias
    };
  });

  return {
    teams,
    locationPool: pool.map((loc) => ({
      id: loc.id,
      name: loc.name,
      fragment: loc.fragment || loc.acceptedAnswers?.[0] || '',
      instruction: loc.instruction,
    })),
    locationUsage: buildLocationUsageSummary(pool, usageCounts),
  };
}

module.exports = {
  listMissionAssignments,
  sortEntriesForFinaleSlots,
};
