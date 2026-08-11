const CampusHuntRound = require('../../models/CampusHuntRound');
const CampusHuntFinaleMissionConfig = require('../../models/CampusHuntFinaleMissionConfig');
const { FINALE_DEFAULTS, FINALE_MISSION_BOARD } = require('../../constants');
const { writeAudit } = require('../auditService');

function deviceConfigLooksEmpty(device) {
  if (!device) return true;
  const loc = String(device.locationName || '').trim();
  const instruction = String(device.instruction || '').trim();
  return !loc && !instruction;
}

/** Migrate legacy Borrowed Device ids/fields → Field Terminal (idempotent). */
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

module.exports = {
  getFinaleRound,
  getOrCreateMissionConfig,
  bootstrapFinale,
  normalizeFinaleMissionConfig,
};
