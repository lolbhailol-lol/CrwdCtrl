/**
 * Bulk-save Clue 1 / Clue 3 variants + checkpoints in one request
 * (avoids 80–120 sequential HTTP calls from the admin UI).
 */

const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const { DEFAULT_SCORING_CONFIG } = require('../constants');
const { resolveCampusStations } = require('./stationCatalogService');
const { resyncClue1TeamBindings } = require('./startScheduleService');
const { writeAudit } = require('./auditService');
const {
  stationForLocalTeam,
  WAIT_POINTS,
} = require('./round1BootstrapService');

function waitIndexFromCode(code) {
  const upper = String(code || '').toUpperCase().trim();
  const idx = WAIT_POINTS.findIndex((w) => w.code === upper);
  return idx >= 0 ? idx : 0;
}

function normalizeWaveId(waveId, localTeamNumber) {
  const raw = String(waveId || '').toUpperCase().trim();
  if (/^T([1-9]|10)$/.test(raw)) return raw;
  const n = Number(localTeamNumber);
  if (n >= 1 && n <= 10) return `T${n}`;
  return null;
}

async function loadContext(eventId, roundId) {
  const event = await CampusHuntEvent.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }
  const round = await CampusHuntRound.findOne({ _id: roundId, eventId });
  if (!round) {
    const err = new Error('Round not found');
    err.status = 404;
    throw err;
  }
  const [routes, startingPoints] = await Promise.all([
    CampusHuntRoute.find({ eventId, active: { $ne: false } }),
    CampusHuntStartingPoint.find({ eventId, active: { $ne: false } }),
  ]);
  const routeByCode = new Map(
    routes.map((route) => [String(route.routeKey || '').toUpperCase(), route]),
  );
  const pointByCode = new Map();
  for (const point of startingPoints) {
    const code = String(point.code || '').toUpperCase().replace(/^START[-_\s]?/, '');
    const wait = /^[A-D]$/.test(code) ? code : String(point.code || '').toUpperCase().charAt(0);
    if (/^[A-D]$/.test(wait) && (!pointByCode.has(wait) || String(point.code).toUpperCase() === wait)) {
      pointByCode.set(wait, point);
    }
  }
  return {
    event,
    round,
    routes,
    startingPoints,
    routeByCode,
    pointByCode,
    stations: resolveCampusStations(event),
  };
}

function resolveRoutePoint(ctx, row, startCode) {
  const route = ctx.routeByCode.get(startCode)
    || ctx.routes.find((r) => String(r._id) === String(row.routeId || ''));
  const point = ctx.pointByCode.get(startCode)
    || ctx.startingPoints.find((p) => String(p._id) === String(row.startingPointId || ''));
  return { route, point };
}

/**
 * @param {object} opts
 * @param {Array<{startCode,waveId,localTeamNumber,prompt,answer,destinationInstruction?,place?,stationCode?,hintText?}>} opts.variants
 */
async function bulkSaveClue1({
  eventId,
  roundId,
  actor = {},
  variants = [],
}) {
  const ctx = await loadContext(eventId, roundId);
  const { event, round } = ctx;
  const clue1Scoring = {
    ...DEFAULT_SCORING_CONFIG.clue1,
    ...(event.scoringConfig?.clue1?.toObject?.() || event.scoringConfig?.clue1 || {}),
    basePoints: 50,
    awardMode: 'flat_base',
  };
  if (!event.scoringConfig) event.scoringConfig = { ...DEFAULT_SCORING_CONFIG };
  event.scoringConfig.clue1 = clue1Scoring;
  event.markModified('scoringConfig');
  await event.save();

  let saved = 0;
  const errors = [];

  for (const row of variants) {
    try {
      const startCode = String(row.startCode || '').toUpperCase().trim();
      const waveId = normalizeWaveId(row.waveId, row.localTeamNumber);
      const localTeamNumber = Number(row.localTeamNumber)
        || Number(String(waveId || '').replace(/^T/, ''))
        || 1;
      if (!/^[A-D]$/.test(startCode) || !waveId) {
        errors.push({ row, message: 'Invalid startCode or waveId' });
        continue;
      }
      const { route, point } = resolveRoutePoint(ctx, row, startCode);
      if (!route || !point) {
        errors.push({ startCode, waveId, message: 'Missing route or starting point' });
        continue;
      }

      const waitIndex = waitIndexFromCode(startCode);
      const station = stationForLocalTeam(localTeamNumber, waitIndex, ctx.stations, 0);
      const place = String(row.place || station.name).trim();
      const stationCode = row.stationCode || station.code;
      const prompt = String(row.prompt || '').trim();
      const answer = String(row.answer || place).trim();
      if (!prompt || !answer) {
        errors.push({ startCode, waveId, message: 'Prompt and answer required' });
        continue;
      }

      const checkpointKey = `1-${waveId}`;
      const firstCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId, routeId: route._id, checkpointKey },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            code: `R${startCode}-${checkpointKey}`,
            progressionKey: '1',
            checkpointNumber: 1,
            checkpointKey,
            locationName: place,
            stationCode,
            publicInstruction:
              `First scan at ${place}. Poster is labeled with the team name `
              + `(Team ${localTeamNumber} from ${point.name || startCode}). `
              + 'Scan only your team QR. All 4 members scan to unlock Clue 2. '
              + 'Then pick up your card and take it so the next teams only find theirs.',
            sequence: 1,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
            capacityGuidance: 4,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const variantKey = `${startCode}-${waveId}`;
      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId,
          routeId: route._id,
          challengeNumber: 1,
          variantKey,
        },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            firstCheckpointId: firstCheckpoint._id,
            challengeNumber: 1,
            type: 'navigation',
            prompt,
            answer,
            acceptedAnswers: [answer, stationCode].filter(Boolean),
            destinationInstruction:
              String(row.destinationInstruction || '').trim()
              || `Go to ${place}. All four members scan there.`,
            hintText: String(row.hintText || '').trim() || `Ask staff for the way to ${place}.`,
            basePoints: 50,
            maxAttempts: 3,
            difficulty: 'medium',
            variantKey,
            active: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      saved += 1;
    } catch (error) {
      errors.push({
        startCode: row.startCode,
        waveId: row.waveId,
        message: error.message || 'Save failed',
      });
    }
  }

  const sync = await resyncClue1TeamBindings({
    eventId,
    roundId: round._id,
    actor,
    reason: 'clue1_bulk_saved',
  });

  await writeAudit({
    eventId,
    ...actor,
    action: 'clue1_bulk_saved',
    targetType: 'round',
    targetId: round._id,
    after: { saved, errors: errors.length, teamsUpdated: sync.updated },
  });

  return {
    saved,
    expected: variants.length,
    errors,
    teamsUpdated: sync.updated,
    firstPostersBound: sync.postersBound,
  };
}

/**
 * @param {Array<{startCode,waveId,localTeamNumber,prompt,answer,hintText?,place?,stationCode?}>} opts.variants
 */
async function bulkSaveClue3({
  eventId,
  roundId,
  actor = {},
  variants = [],
}) {
  const ctx = await loadContext(eventId, roundId);
  const { event, round } = ctx;
  const clue3Scoring = {
    ...DEFAULT_SCORING_CONFIG.clue3,
    ...(event.scoringConfig?.clue3?.toObject?.() || event.scoringConfig?.clue3 || {}),
    basePoints: 50,
    awardMode: 'flat_base',
  };
  if (!event.scoringConfig) event.scoringConfig = { ...DEFAULT_SCORING_CONFIG };
  event.scoringConfig.clue3 = clue3Scoring;
  event.markModified('scoringConfig');
  await event.save();

  let saved = 0;
  const errors = [];

  for (const row of variants) {
    try {
      const startCode = String(row.startCode || '').toUpperCase().trim();
      const waveId = normalizeWaveId(row.waveId, row.localTeamNumber);
      const localTeamNumber = Number(row.localTeamNumber)
        || Number(String(waveId || '').replace(/^T/, ''))
        || 1;
      if (!/^[A-D]$/.test(startCode) || !waveId) {
        errors.push({ row, message: 'Invalid startCode or waveId' });
        continue;
      }
      const { route, point } = resolveRoutePoint(ctx, row, startCode);
      if (!route || !point) {
        errors.push({ startCode, waveId, message: 'Missing route or starting point' });
        continue;
      }

      const waitIndex = waitIndexFromCode(startCode);
      const station = stationForLocalTeam(localTeamNumber, waitIndex, ctx.stations, 2);
      const place = String(row.place || station.name).trim();
      const stationCode = row.stationCode || station.code;
      const prompt = String(row.prompt || '').trim();
      const answer = String(row.answer || place).trim();
      if (!prompt || !answer) {
        errors.push({ startCode, waveId, message: 'Riddle prompt and answer required' });
        continue;
      }

      const checkpointKey = `3-${waveId}`;
      const thirdCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId, routeId: route._id, checkpointKey },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            code: `R${startCode}-${checkpointKey}`,
            progressionKey: '3',
            checkpointNumber: 3,
            checkpointKey,
            locationName: place,
            stationCode,
            publicInstruction:
              `THIRD SCAN (blue) at ${place} (team ${localTeamNumber}). `
              + 'Scan only after Clue 3 riddle. This card is for your team only. '
              + 'All 4 members scan to unlock the Final clue. '
              + 'Then pick up your blue card and take it.',
            sequence: 3,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
            capacityGuidance: 4,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const variantKey = `${startCode}-${waveId}`;
      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId,
          routeId: route._id,
          challengeNumber: 3,
          variantKey,
        },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            thirdCheckpointId: thirdCheckpoint._id,
            challengeNumber: 3,
            type: 'decode',
            prompt,
            answer,
            acceptedAnswers: [answer],
            destinationInstruction:
              'Riddle solved — go find your blue Checkpoint 3 card at that place. '
              + 'All 4 members scan to unlock Final.',
            hintText:
              String(row.hintText || '').trim()
              || 'Caesar shift of 3 — A becomes D, B becomes E… Spaces stay spaces.',
            basePoints: 50,
            maxAttempts: 3,
            hintCost: Number(event.scoringConfig?.hintCost) || 15,
            difficulty: 'medium',
            variantKey,
            active: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      saved += 1;
    } catch (error) {
      errors.push({
        startCode: row.startCode,
        waveId: row.waveId,
        message: error.message || 'Save failed',
      });
    }
  }

  const sync = await resyncClue1TeamBindings({
    eventId,
    roundId: round._id,
    actor,
    reason: 'clue3_bulk_saved',
  });

  await writeAudit({
    eventId,
    ...actor,
    action: 'clue3_bulk_saved',
    targetType: 'round',
    targetId: round._id,
    after: {
      saved,
      errors: errors.length,
      thirdPostersBound: sync.thirdPostersBound,
      teamsUpdated: sync.updated,
    },
  });

  return {
    saved,
    expected: variants.length,
    errors,
    teamsUpdated: sync.updated,
    thirdPostersBound: sync.thirdPostersBound,
  };
}

module.exports = {
  bulkSaveClue1,
  bulkSaveClue3,
};
