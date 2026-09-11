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
const { persistClueScoring } = require('./clueScoringPersistService');
const { resolveCampusStations } = require('./stationCatalogService');
const { resyncClue1TeamBindings } = require('./startScheduleService');
const { writeAudit } = require('./auditService');
const {
  stationForLocalTeam,
  WAIT_POINTS,
  syncSharedStationQrs,
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
  scoring = {},
  variants = [],
}) {
  const ctx = await loadContext(eventId, roundId);
  const { round } = ctx;
  const { scoring: clue1Scoring } = await persistClueScoring({
    eventId,
    clueNumber: 1,
    scoring,
  });
  const event = await CampusHuntEvent.findById(eventId);

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
      const stationCode = String(row.stationCode || station.code || '').toUpperCase().trim();
      const prompt = String(row.prompt || '').trim();
      const answer = String(row.answer || place).trim();
      if (!prompt || !answer) {
        errors.push({ startCode, waveId, message: 'Prompt and answer required' });
        continue;
      }

      // Shared station QR (one per place) — do not recreate team-bound R*-1-T* posters
      const sharedCode = `ST-${stationCode}-1`;
      const firstCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId, code: sharedCode },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            code: sharedCode,
            progressionKey: '1',
            checkpointNumber: 1,
            checkpointKey: `1-${stationCode}`,
            locationName: place,
            stationCode,
            publicInstruction:
              `Orange FIRST SCAN at ${place}. One shared QR for this place. `
              + 'All 4 team members scan, then enter your team code to unlock Clue 2.',
            sequence: 1,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
            capacityGuidance: 4,
            concurrencyGuidance: 'Shared station QR — about 4 teams visit across the event.',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      // Keep legacy wave posters retired if they reappear
      await CampusHuntCheckpoint.updateMany(
        {
          eventId,
          progressionKey: '1',
          stationCode,
          code: { $not: /^ST-/i },
          active: true,
        },
        { $set: { active: false } },
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
              || `Go to ${place}. Find the shared orange FIRST SCAN QR. `
                + `All ${Math.max(2, Math.min(8, Number(event.teamSize) || 4))} members scan, then enter your team code to unlock Clue 2.`,
            hintText: String(row.hintText || '').trim() || `Ask staff for the way to ${place}.`,
            basePoints: clue1Scoring.basePoints,
            maxAttempts: clue1Scoring.maxAttempts,
            hintCost: clue1Scoring.hintCost,
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

  const sharedQr = await syncSharedStationQrs(event, round, ctx.routes);

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
    after: { saved, errors: errors.length, teamsUpdated: sync.updated, sharedQr },
  });

  return {
    saved,
    expected: variants.length,
    errors,
    teamsUpdated: sync.updated,
    firstPostersBound: sync.postersBound,
    sharedQr,
  };
}

/**
 * @param {Array<{startCode,waveId,localTeamNumber,prompt,answer,hintText?,place?,stationCode?}>} opts.variants
 */
async function bulkSaveClue3({
  eventId,
  roundId,
  actor = {},
  scoring = {},
  variants = [],
}) {
  const ctx = await loadContext(eventId, roundId);
  const { round } = ctx;
  const { scoring: clue3Scoring } = await persistClueScoring({
    eventId,
    clueNumber: 3,
    scoring,
  });
  const event = await CampusHuntEvent.findById(eventId);

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
      const stationCode = String(row.stationCode || station.code || '').toUpperCase().trim();
      const prompt = String(row.prompt || '').trim();
      const answer = String(row.answer || place).trim();
      if (!prompt || !answer) {
        errors.push({ startCode, waveId, message: 'Riddle prompt and answer required' });
        continue;
      }

      const sharedCode = `ST-${stationCode}-3`;
      const thirdCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId, code: sharedCode },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            code: sharedCode,
            progressionKey: '3',
            checkpointNumber: 3,
            checkpointKey: `3-${stationCode}`,
            locationName: place,
            stationCode,
            publicInstruction:
              `Blue THIRD SCAN at ${place}. One shared QR for this place. `
              + 'All 4 team members scan, then enter your team code to unlock Final.',
            sequence: 3,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
            capacityGuidance: 4,
            concurrencyGuidance: 'Shared station QR — about 4 teams visit across the event.',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      await CampusHuntCheckpoint.updateMany(
        {
          eventId,
          progressionKey: '3',
          stationCode,
          code: { $not: /^ST-/i },
          active: true,
        },
        { $set: { active: false } },
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
              `Riddle solved — go to ${place}. Find the shared blue THIRD SCAN QR. `
              + `All ${Math.max(2, Math.min(8, Number(event.teamSize) || 4))} members scan, then enter your team code to unlock Final.`,
            hintText:
              String(row.hintText || '').trim()
              || 'Caesar shift of 3 — A becomes D, B becomes E… Spaces stay spaces.',
            basePoints: clue3Scoring.basePoints,
            maxAttempts: clue3Scoring.maxAttempts,
            hintCost: clue3Scoring.hintCost,
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

  const sharedQr = await syncSharedStationQrs(event, round, ctx.routes);

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
      sharedQr,
    },
  });

  return {
    saved,
    expected: variants.length,
    errors,
    teamsUpdated: sync.updated,
    thirdPostersBound: sync.thirdPostersBound,
    sharedQr,
  };
}

module.exports = {
  bulkSaveClue1,
  bulkSaveClue3,
};
