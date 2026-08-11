const CampusHuntRound = require('../../models/CampusHuntRound');
const CampusHuntFinaleMissionConfig = require('../../models/CampusHuntFinaleMissionConfig');
const {
  FINALE_DEFAULTS,
  FINALE_MISSION_BOARD,
  DEFAULT_LOCKBOX_CONFIG,
  DEFAULT_BLACKOUT_CONFIG,
} = require('../../constants');
const { writeAudit } = require('../auditService');

function deviceConfigLooksEmpty(device) {
  if (!device) return true;
  const loc = String(device.locationName || '').trim();
  const instruction = String(device.instruction || '').trim();
  return !loc && !instruction;
}

function lockboxLooksEmpty(lb) {
  if (!lb) return true;
  const clue = String(lb.clue || '').trim();
  const codes = Array.isArray(lb.acceptedCodes) ? lb.acceptedCodes.filter(Boolean) : [];
  const keys = Array.isArray(lb.keyPool) ? lb.keyPool : [];
  return !clue && codes.length === 0 && keys.length === 0;
}

const LEGACY_PLACEHOLDER_IDS = new Set([
  'mission_3',
  'mission_4',
  'mission_5',
  'mission_3_placeholder',
  'mission_4_placeholder',
  'mission_5_placeholder',
]);

const CANONICAL_MISSION_IDS = new Set(FINALE_MISSION_BOARD.map((m) => m.id));

/**
 * Keep mission board ordered as Intel → Lockbox → Field Terminal → Blackout.
 * Drops Mission 5 / legacy placeholders — only the 4 live missions remain.
 */
function syncMissionBoardRows(config) {
  const existing = Array.isArray(config.missions) ? config.missions : [];
  const byId = new Map();
  for (const row of existing) {
    if (!row?.id) continue;
    const id = row.id === 'borrowed_device' ? 'field_terminal' : row.id;
    if (LEGACY_PLACEHOLDER_IDS.has(id) || !CANONICAL_MISSION_IDS.has(id)) continue;
    byId.set(id, { ...row, id });
  }

  let dirty = false;
  const next = FINALE_MISSION_BOARD.map((def) => {
    const prev = byId.get(def.id);
    if (!prev) {
      dirty = true;
      return { ...def };
    }
    const merged = {
      ...def,
      ...prev,
      id: def.id,
      emoji: prev.emoji || def.emoji,
      title: prev.title || def.title,
      enabled: prev.enabled !== false,
      comingSoon: Boolean(def.comingSoon),
    };
    // Bump Field Terminal default 100 → 125 when still on old board default
    if (def.id === 'field_terminal' && Number(prev.points) === 100) {
      merged.points = 125;
      dirty = true;
    } else if (prev.points == null && def.points != null) {
      merged.points = def.points;
      dirty = true;
    }
    if (prev.id !== def.id
      || prev.title !== merged.title
      || Number(prev.points) !== Number(merged.points)
      || Boolean(prev.comingSoon) !== Boolean(merged.comingSoon)) {
      dirty = true;
    }
    return merged;
  });

  const prevIds = existing.map((m) => m.id).join(',');
  const nextIds = next.map((m) => m.id).join(',');
  if (prevIds !== nextIds) dirty = true;

  if (dirty) {
    config.missions = next;
    config.markModified('missions');
  }
  return dirty;
}

/** Migrate legacy Borrowed Device ids/fields → Field Terminal; ensure Lockbox board slot. */
async function normalizeFinaleMissionConfig(config) {
  if (!config) return config;
  let dirty = false;

  const missions = Array.isArray(config.missions) ? config.missions : [];
  for (const row of missions) {
    if (row?.id === 'borrowed_device') {
      row.id = 'field_terminal';
      if (!row.title || /borrowed/i.test(String(row.title))) {
        row.title = 'Field Terminal';
      }
      dirty = true;
    }
  }
  if (dirty) config.markModified('missions');

  if (syncMissionBoardRows(config)) dirty = true;

  const legacy = config.borrowedDevice?.toObject?.() || config.borrowedDevice || {};
  const current = config.fieldTerminal?.toObject?.() || config.fieldTerminal || {};
  if (deviceConfigLooksEmpty(current) && !deviceConfigLooksEmpty(legacy)) {
    config.fieldTerminal = {
      locationName: legacy.locationName || '',
      instruction: legacy.instruction || '',
      maxAttempts: Number(legacy.maxAttempts) || FINALE_DEFAULTS.fieldTerminalMaxAttempts,
    };
    config.markModified('fieldTerminal');
    dirty = true;
  } else if (!deviceConfigLooksEmpty(current)) {
    // Keep legacy mirror in sync for older admin clients
    const mirror = {
      locationName: current.locationName || '',
      instruction: current.instruction || '',
      maxAttempts: Number(current.maxAttempts) || FINALE_DEFAULTS.fieldTerminalMaxAttempts,
    };
    const legacyLoc = String(legacy.locationName || '').trim();
    const legacyInstr = String(legacy.instruction || '').trim();
    if (legacyLoc !== String(mirror.locationName).trim()
      || legacyInstr !== String(mirror.instruction).trim()) {
      config.borrowedDevice = mirror;
      config.markModified('borrowedDevice');
      dirty = true;
    }
  }

  const lb = config.lockbox?.toObject?.() || config.lockbox || {};
  if (lockboxLooksEmpty(lb)) {
    config.lockbox = {
      clue: DEFAULT_LOCKBOX_CONFIG.clue,
      locationName: DEFAULT_LOCKBOX_CONFIG.locationName,
      locationHint: DEFAULT_LOCKBOX_CONFIG.locationHint,
      keyPool: DEFAULT_LOCKBOX_CONFIG.keyPool.map((k) => ({ ...k })),
      codePool: DEFAULT_LOCKBOX_CONFIG.codePool.map((c) => ({
        id: c.id,
        acceptedCodes: [...c.acceptedCodes],
        playerPieces: c.playerPieces.map((p) => ({ ...p })),
      })),
      maxAttemptsKey: FINALE_DEFAULTS.lockboxMaxAttemptsPerStep,
      maxAttemptsCode: FINALE_DEFAULTS.lockboxMaxAttemptsPerStep,
      playerPieces: DEFAULT_LOCKBOX_CONFIG.playerPieces.map((p) => ({ ...p })),
      acceptedCodes: [...DEFAULT_LOCKBOX_CONFIG.acceptedCodes],
      lockboxInstruction: DEFAULT_LOCKBOX_CONFIG.lockboxInstruction,
    };
    config.markModified('lockbox');
    dirty = true;
  } else if (!Array.isArray(lb.codePool) || lb.codePool.length === 0) {
    config.lockbox = {
      ...lb,
      codePool: DEFAULT_LOCKBOX_CONFIG.codePool.map((c) => ({
        id: c.id,
        acceptedCodes: [...c.acceptedCodes],
        playerPieces: c.playerPieces.map((p) => ({ ...p })),
      })),
    };
    config.markModified('lockbox');
    dirty = true;
  }

  const blackout = config.blackout?.toObject?.() || config.blackout || {};
  if (!blackout || !blackout.scout) {
    config.blackout = {
      ...DEFAULT_BLACKOUT_CONFIG,
      scout: { ...DEFAULT_BLACKOUT_CONFIG.scout },
      cracker: { ...DEFAULT_BLACKOUT_CONFIG.cracker },
      navigator: { ...DEFAULT_BLACKOUT_CONFIG.navigator },
      controller: { ...DEFAULT_BLACKOUT_CONFIG.controller },
      routePool: [...DEFAULT_BLACKOUT_CONFIG.routePool],
    };
    config.markModified('blackout');
    dirty = true;
  }

  if (dirty) await config.save();
  return config;
}

async function getFinaleRound(eventId) {
  return CampusHuntRound.findOne({ eventId, name: 'FINALE' });
}

async function getOrCreateMissionConfig(eventId, roundId) {
  let config = await CampusHuntFinaleMissionConfig.findOne({ eventId });
  if (!config) {
    config = await CampusHuntFinaleMissionConfig.create({
      eventId,
      roundId,
      startingScore: FINALE_DEFAULTS.startingScore,
      durationMinutes: FINALE_DEFAULTS.durationMinutes,
      missions: FINALE_MISSION_BOARD.map((m) => ({ ...m })),
      lockbox: {
        ...DEFAULT_LOCKBOX_CONFIG,
        keyPool: DEFAULT_LOCKBOX_CONFIG.keyPool.map((k) => ({ ...k })),
        codePool: DEFAULT_LOCKBOX_CONFIG.codePool.map((c) => ({
          id: c.id,
          acceptedCodes: [...c.acceptedCodes],
          playerPieces: c.playerPieces.map((p) => ({ ...p })),
        })),
        playerPieces: DEFAULT_LOCKBOX_CONFIG.playerPieces.map((p) => ({ ...p })),
        acceptedCodes: [...DEFAULT_LOCKBOX_CONFIG.acceptedCodes],
      },
      blackout: {
        ...DEFAULT_BLACKOUT_CONFIG,
        scout: { ...DEFAULT_BLACKOUT_CONFIG.scout },
        cracker: { ...DEFAULT_BLACKOUT_CONFIG.cracker },
        navigator: { ...DEFAULT_BLACKOUT_CONFIG.navigator },
        controller: { ...DEFAULT_BLACKOUT_CONFIG.controller },
        routePool: [...DEFAULT_BLACKOUT_CONFIG.routePool],
      },
    });
  } else if (roundId && String(config.roundId || '') !== String(roundId)) {
    config.roundId = roundId;
    await config.save();
  }
  return normalizeFinaleMissionConfig(config);
}

async function bootstrapFinale({ eventId, actor = {} }) {
  let round = await getFinaleRound(eventId);
  if (!round) {
    const maxRound = await CampusHuntRound.findOne({ eventId })
      .sort({ roundNumber: -1 })
      .select('roundNumber')
      .lean();
    const roundNumber = (maxRound?.roundNumber || 1) + 1;
    round = await CampusHuntRound.create({
      eventId,
      roundNumber,
      name: 'FINALE',
      status: 'scheduled',
      scheduleStatus: 'draft',
      qualification: {
        topNDirectFinale: FINALE_DEFAULTS.directFromR1,
        survivalTeams: 35,
        lastChanceTeams: 0,
        finaleTeams: FINALE_DEFAULTS.maxFinalists,
        nextRoundName: 'FINALE',
      },
    });
  }

  const config = await getOrCreateMissionConfig(eventId, round._id);

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_bootstrapped',
    targetType: 'round',
    targetId: round._id,
  });

  return { round, config };
}

/**
 * Testing reset — clear all finalist progress.
 * @param {boolean} keepLive — if true and round is live, wipe teams only (stay live).
 *   if false (default), turn Finals off → re-generate schedule & Start again.
 */
async function resetFinaleForRetest({ eventId, actor = {}, keepLive = false }) {
  const CampusHuntFinaleEntry = require('../../models/CampusHuntFinaleEntry');
  const CampusHuntFinaleMissionRun = require('../../models/CampusHuntFinaleMissionRun');
  const CampusHuntGridSession = require('../../models/CampusHuntGridSession');

  const round = await getFinaleRound(eventId);
  if (!round) {
    const err = new Error('Finale round not bootstrapped.');
    err.status = 400;
    err.code = 'FINALE_NOT_BOOTSTRAPPED';
    throw err;
  }
  if (round.status === 'finalized') {
    const err = new Error('Finalized Finals cannot be reset. Create a new event or clear finalize in DB.');
    err.status = 409;
    err.code = 'FINALE_FINALIZED';
    throw err;
  }

  const config = await getOrCreateMissionConfig(eventId, round._id);
  const starting = Number(config.startingScore) || FINALE_DEFAULTS.startingScore;
  const stayLive = Boolean(keepLive) && round.status === 'live';

  if (!stayLive) {
    await CampusHuntRound.updateOne(
      { _id: round._id },
      {
        $set: {
          status: 'scheduled',
          scheduleStatus: 'draft',
          releasesPaused: false,
        },
        $unset: {
          startsAt: 1,
          endsAt: 1,
          scheduleLockedAt: 1,
          lockedAt: 1,
        },
      },
    );
  }

  const entryUnset = {
    finalScore: 1,
    stoppedAt: 1,
    lockedAt: 1,
    releasedAt: 1,
    // Always clear schedule on wipe so keepLive doesn't auto-unlock via scheduledStartAt
    scheduledStartAt: 1,
  };
  if (!stayLive) {
    entryUnset.meetLocationCode = 1;
    entryUnset.meetLocationName = 1;
    entryUnset.finaleSlot = 1;
    entryUnset.releaseWave = 1;
  }

  await CampusHuntFinaleEntry.updateMany(
    { eventId },
    {
      $set: {
        status: 'eligible',
        completedMissionIds: [],
        activeMissionId: null,
        activeMissionRunId: null,
        finaleScore: starting,
      },
      $unset: entryUnset,
    },
  );

  await CampusHuntFinaleMissionRun.updateMany(
    { eventId, status: { $in: ['active', 'completed'] } },
    { $set: { status: 'abandoned' } },
  );

  await CampusHuntGridSession.updateMany(
    { eventId, status: { $in: ['active', 'completed'] } },
    { $set: { status: 'expired' } },
  );

  await writeAudit({
    eventId,
    ...actor,
    action: stayLive ? 'finale_playtest_reset_round_keep_live' : 'finale_playtest_reset_round',
    targetType: 'round',
    targetId: round._id,
    after: {
      status: stayLive ? 'live' : 'scheduled',
      startingScore: starting,
      keepLive: stayLive,
    },
  });

  const fresh = await getFinaleRound(eventId);
  return { round: fresh, config, keepLive: stayLive };
}

module.exports = {
  getFinaleRound,
  getOrCreateMissionConfig,
  bootstrapFinale,
  normalizeFinaleMissionConfig,
  resetFinaleForRetest,
};
