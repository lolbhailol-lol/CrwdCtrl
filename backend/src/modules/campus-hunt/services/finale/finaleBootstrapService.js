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

const CONFIG_CACHE_MS = 1500;
const normalizedAtByEvent = new Map();

function cacheKey(eventId) {
  return String(eventId || '');
}

function markNormalized(eventId) {
  if (eventId) normalizedAtByEvent.set(cacheKey(eventId), Date.now());
}

function recentlyNormalized(eventId) {
  const at = normalizedAtByEvent.get(cacheKey(eventId));
  return Boolean(at && Date.now() - at < CONFIG_CACHE_MS);
}

function isVersionConflict(err) {
  return err?.name === 'VersionError'
    || /No matching document found for id/i.test(String(err?.message || ''));
}

function storedMission(row) {
  if (!row) return null;
  const raw = typeof row.toObject === 'function' ? row.toObject() : row;
  const id = raw?.id;
  if (!id) return null;
  return {
    id: String(id),
    title: String(raw.title || ''),
    emoji: String(raw.emoji || ''),
    points: Number(raw.points) || 0,
    enabled: raw.enabled !== false,
    comingSoon: Boolean(raw.comingSoon),
  };
}

function canonicalId(id) {
  return id === 'borrowed_device' ? 'field_terminal' : id;
}

function missionFingerprint(rows) {
  return JSON.stringify(
    (Array.isArray(rows) ? rows : []).map(storedMission).filter(Boolean),
  );
}

/**
 * Keep mission board ordered as Intel → Lockbox → Field Terminal → Blackout.
 * Drops Mission 5 / legacy placeholders — only the 4 live missions remain.
 * Returns true only when canonical fields actually change.
 */
function syncMissionBoardRows(config) {
  const existing = Array.isArray(config.missions) ? config.missions : [];
  const byId = new Map();
  for (const row of existing) {
    const prev = storedMission(row);
    if (!prev) continue;
    const id = canonicalId(prev.id);
    if (LEGACY_PLACEHOLDER_IDS.has(id) || !CANONICAL_MISSION_IDS.has(id)) continue;
    byId.set(id, { ...prev, id });
  }

  const next = FINALE_MISSION_BOARD.map((def) => {
    const prev = byId.get(def.id);
    if (!prev) return { ...def, enabled: def.enabled !== false, comingSoon: Boolean(def.comingSoon) };
    let title = prev.title || def.title;
    if (/borrowed/i.test(String(prev.title || '')) && def.id === 'field_terminal') {
      title = def.title;
    }
    const merged = {
      id: def.id,
      emoji: prev.emoji || def.emoji,
      title,
      points: Number(prev.points),
      enabled: prev.enabled !== false,
      comingSoon: Boolean(def.comingSoon),
    };
    if (def.id === 'field_terminal' && merged.points === 100) {
      merged.points = 125;
    } else if (!merged.points && def.points != null) {
      merged.points = Number(def.points) || 0;
    }
    return merged;
  });

  const dirty = missionFingerprint(existing) !== missionFingerprint(next);
  if (dirty) {
    config.missions = next;
    config.markModified?.('missions');
  }
  return dirty;
}

async function persistConfigPatch(config, patch) {
  if (!config?._id || !patch || !Object.keys(patch).length) return config;
  try {
    await CampusHuntFinaleMissionConfig.updateOne(
      { _id: config._id },
      { $set: patch },
    );
  } catch (err) {
    if (!isVersionConflict(err)) throw err;
  }
  const fresh = await CampusHuntFinaleMissionConfig.findById(config._id);
  markNormalized(fresh?.eventId || config.eventId);
  return fresh || config;
}

/** Migrate legacy Borrowed Device ids/fields → Field Terminal; ensure Lockbox board slot. */
async function normalizeFinaleMissionConfig(config) {
  if (!config) return config;
  const patch = {};

  if (syncMissionBoardRows(config)) {
    patch.missions = config.missions;
  }

  const legacy = config.borrowedDevice?.toObject?.() || config.borrowedDevice || {};
  const current = config.fieldTerminal?.toObject?.() || config.fieldTerminal || {};
  if (deviceConfigLooksEmpty(current) && !deviceConfigLooksEmpty(legacy)) {
    patch.fieldTerminal = {
      locationName: legacy.locationName || '',
      instruction: legacy.instruction || '',
      maxAttempts: Number(legacy.maxAttempts) || FINALE_DEFAULTS.fieldTerminalMaxAttempts,
    };
    config.fieldTerminal = patch.fieldTerminal;
  } else if (!deviceConfigLooksEmpty(current)) {
    const mirror = {
      locationName: current.locationName || '',
      instruction: current.instruction || '',
      maxAttempts: Number(current.maxAttempts) || FINALE_DEFAULTS.fieldTerminalMaxAttempts,
    };
    const legacyLoc = String(legacy.locationName || '').trim();
    const legacyInstr = String(legacy.instruction || '').trim();
    if (legacyLoc !== String(mirror.locationName).trim()
      || legacyInstr !== String(mirror.instruction).trim()) {
      patch.borrowedDevice = mirror;
      config.borrowedDevice = mirror;
    }
  }

  const lb = config.lockbox?.toObject?.() || config.lockbox || {};
  if (lockboxLooksEmpty(lb)) {
    patch.lockbox = {
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
    config.lockbox = patch.lockbox;
  } else if (!Array.isArray(lb.codePool) || lb.codePool.length === 0) {
    patch.lockbox = {
      ...lb,
      codePool: DEFAULT_LOCKBOX_CONFIG.codePool.map((c) => ({
        id: c.id,
        acceptedCodes: [...c.acceptedCodes],
        playerPieces: c.playerPieces.map((p) => ({ ...p })),
      })),
    };
    config.lockbox = patch.lockbox;
  }

  const blackout = config.blackout?.toObject?.() || config.blackout || {};
  if (!blackout || !blackout.scout) {
    patch.blackout = {
      ...DEFAULT_BLACKOUT_CONFIG,
      scout: { ...DEFAULT_BLACKOUT_CONFIG.scout },
      cracker: { ...DEFAULT_BLACKOUT_CONFIG.cracker },
      navigator: { ...DEFAULT_BLACKOUT_CONFIG.navigator },
      controller: { ...DEFAULT_BLACKOUT_CONFIG.controller },
      routePool: [...DEFAULT_BLACKOUT_CONFIG.routePool],
    };
    config.blackout = patch.blackout;
  }

  if (Object.keys(patch).length) {
    return persistConfigPatch(config, patch);
  }
  markNormalized(config.eventId);
  return config;
}

async function getFinaleRound(eventId) {
  return CampusHuntRound.findOne({ eventId, name: 'FINALE' });
}

async function getOrCreateMissionConfig(eventId, roundId) {
  try {
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
      markNormalized(eventId);
      return config;
    }
    if (roundId && String(config.roundId || '') !== String(roundId)) {
      config = await persistConfigPatch(config, { roundId });
    }
    if (recentlyNormalized(eventId)) return config;
    return await normalizeFinaleMissionConfig(config);
  } catch (err) {
    if (!isVersionConflict(err) && err?.code !== 11000) throw err;
    const fresh = await CampusHuntFinaleMissionConfig.findOne({ eventId });
    if (!fresh) throw err;
    markNormalized(eventId);
    return fresh;
  }
}

async function bootstrapFinale({ eventId, actor = {} }) {
  let round = await getFinaleRound(eventId);
  if (!round) {
    const CampusHuntEvent = require('../../models/CampusHuntEvent');
    const { deriveCompetitionFormat } = require('../../utils/competitionFormat');
    const event = await CampusHuntEvent.findById(eventId).select('teamCapacity teamSize').lean();
    const r1 = await CampusHuntRound.findOne({ eventId, roundNumber: 1 }).lean();
    const format = deriveCompetitionFormat({
      teamCapacity: event?.teamCapacity,
      teamSize: event?.teamSize,
      directFromR1: r1?.qualification?.topNDirectFinale,
      finaleTeams: r1?.qualification?.finaleTeams,
    });
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
        ...format.qualification,
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
  syncMissionBoardRows,
};
