/**
 * Bulk-save Clue 2 variants + SECOND SCAN checkpoints in one request
 * (avoids admin rate-limit 429s from 80–120 sequential HTTP calls).
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
  threeDigitCodeForTeam,
  WAIT_POINTS,
} = require('./round1BootstrapService');

const SHARED_PROMPT =
  'A staff mark hides in plain sight nearby. '
  + 'Scan the area at eye level — find your team’s 3-digit number.';

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

/**
 * @param {object} opts
 * @param {string} opts.eventId
 * @param {string} opts.roundId
 * @param {object} [opts.actor]
 * @param {string} [opts.prompt]
 * @param {object} [opts.scoring] clue2 scoring overrides
 * @param {Array<{startCode,waveId,localTeamNumber,answer,routeId?,startingPointId?}>} opts.variants
 */
async function bulkSaveClue2({
  eventId,
  roundId,
  actor = {},
  prompt,
  scoring = {},
  variants = [],
}) {
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

  const [routes, startingPointsRaw] = await Promise.all([
    CampusHuntRoute.find({ eventId, active: { $ne: false } }),
    CampusHuntStartingPoint.find({ eventId, active: { $ne: false } }),
  ]);
  // Prefer points on this round; otherwise use any active A–D for the event.
  let startingPoints = startingPointsRaw.filter(
    (point) => String(point.roundId) === String(round._id),
  );
  if (startingPoints.length < 4) startingPoints = startingPointsRaw;
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

  const stations = resolveCampusStations(event);
  const cluePrompt = String(prompt || '').trim() || SHARED_PROMPT;
  const clue2Scoring = {
    ...DEFAULT_SCORING_CONFIG.clue2,
    ...(event.scoringConfig?.clue2?.toObject?.() || event.scoringConfig?.clue2 || {}),
    ...scoring,
    timerSeconds: Number(scoring.timerSeconds ?? event.scoringConfig?.clue2?.timerSeconds) || 180,
    timerStartDelaySeconds:
      Number(scoring.timerStartDelaySeconds ?? event.scoringConfig?.clue2?.timerStartDelaySeconds) || 20,
    maxAttempts: Number(scoring.maxAttempts ?? event.scoringConfig?.clue2?.maxAttempts) || 3,
    hintCost: Number(scoring.hintCost ?? event.scoringConfig?.hintCost) || 15,
    allowLateSubmit: scoring.allowLateSubmit !== false,
    awardMode: 'time_bands_total',
    basePoints: 0,
    speedBonusBands:
      (Array.isArray(scoring.speedBonusBands) && scoring.speedBonusBands.length)
        ? scoring.speedBonusBands
        : DEFAULT_SCORING_CONFIG.clue2.speedBonusBands,
  };

  if (!event.scoringConfig) event.scoringConfig = { ...DEFAULT_SCORING_CONFIG };
  event.scoringConfig.clue2 = clue2Scoring;
  event.markModified('scoringConfig');
  await event.save();

  if (typeof CampusHuntChallenge.ensureChallengeIndexes === 'function') {
    await CampusHuntChallenge.ensureChallengeIndexes();
  }

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
      const answer = String(row.answer || '').trim();
      if (!/^\d{3}$/.test(answer)) {
        errors.push({ startCode, waveId, message: 'Answer must be a 3-digit code' });
        continue;
      }

      const waitIndex = waitIndexFromCode(startCode);
      const route = routeByCode.get(startCode)
        || routes.find((r) => String(r._id) === String(row.routeId || ''));
      const point = pointByCode.get(startCode)
        || startingPoints.find((p) => String(p._id) === String(row.startingPointId || ''));
      if (!route || !point) {
        errors.push({ startCode, waveId, message: 'Missing route or starting point' });
        continue;
      }

      const station = stationForLocalTeam(localTeamNumber, waitIndex, stations, 1);
      const place = row.place || station.name;
      const stationCode = String(row.stationCode || station.code || '').toUpperCase().trim();
      const sharedCode = `ST-${stationCode}-2`;

      const secondCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId, code: sharedCode },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            code: sharedCode,
            progressionKey: '2',
            checkpointNumber: 2,
            checkpointKey: `2-${stationCode}`,
            locationName: place,
            stationCode,
            publicInstruction:
              `Green SECOND SCAN at ${place}. One shared QR for this place. `
              + 'All 4 team members scan, then enter your team code to unlock Clue 3.',
            sequence: 2,
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
          progressionKey: '2',
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
          challengeNumber: 2,
          variantKey,
        },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            secondCheckpointId: secondCheckpoint._id,
            challengeNumber: 2,
            type: 'timed_search',
            prompt: cluePrompt,
            answer,
            acceptedAnswers: [answer],
            destinationInstruction:
              `Go to ${place} now. Find the shared green SECOND SCAN QR. `
              + 'All 4 members scan, then enter your team code to unlock Clue 3.',
            hintText: 'Check posts, pillars, and notice boards at eye level.',
            basePoints: 0,
            maxAttempts: clue2Scoring.maxAttempts,
            timerSeconds: clue2Scoring.timerSeconds,
            speedBonusBands: clue2Scoring.speedBonusBands,
            hintCost: clue2Scoring.hintCost,
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

  // Hide legacy shared CP2 / DEFAULT clue2
  await CampusHuntCheckpoint.updateMany(
    { eventId, checkpointKey: '2', progressionKey: '2' },
    { $set: { active: false } },
  );
  await CampusHuntChallenge.updateMany(
    { eventId, challengeNumber: 2, variantKey: 'DEFAULT' },
    { $set: { active: false } },
  );

  const sync = await resyncClue1TeamBindings({
    eventId,
    roundId: round._id,
    actor,
    reason: 'clue2_bulk_saved',
  });

  await writeAudit({
    eventId,
    ...actor,
    action: 'clue2_bulk_saved',
    targetType: 'round',
    targetId: round._id,
    after: {
      saved,
      errors: errors.length,
      secondPostersBound: sync.secondPostersBound,
      teamsUpdated: sync.updated,
    },
  });

  return {
    saved,
    expected: variants.length,
    errors,
    teamsUpdated: sync.updated,
    secondPostersBound: sync.secondPostersBound,
    scoring: clue2Scoring,
  };
}

/** Build default 40 variant rows (for admin UI / bootstrap helpers). */
function defaultClue2VariantRows(stations = null) {
  const list = stations?.length ? stations : resolveCampusStations(null);
  const rows = [];
  WAIT_POINTS.forEach((start, waitIndex) => {
    for (let local = 1; local <= 10; local += 1) {
      const station = stationForLocalTeam(local, waitIndex, list, 1);
      rows.push({
        startCode: start.code,
        waveId: `T${local}`,
        localTeamNumber: local,
        answer: threeDigitCodeForTeam(waitIndex, local),
        place: station.name,
        stationCode: station.code,
      });
    }
  });
  return rows;
}

module.exports = {
  bulkSaveClue2,
  defaultClue2VariantRows,
  SHARED_PROMPT,
};
