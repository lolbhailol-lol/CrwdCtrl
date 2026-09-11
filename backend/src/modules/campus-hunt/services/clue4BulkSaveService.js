/**
 * Bulk-save Clue 4 prop-hunt variants + FOURTH SCAN checkpoints in one request.
 */

const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const { persistClueScoring } = require('./clueScoringPersistService');
const { resyncClue1TeamBindings } = require('./startScheduleService');
const { writeAudit } = require('./auditService');
const {
  stationForLocalTeam,
  propCodeForTeam,
  WAIT_POINTS,
  syncSharedStationQrs,
  routeClueDefaults,
} = require('./round1BootstrapService');

const SHARED_PROMPT =
  'CRAZY PROP HUNT — hunt as a team for the silly planted prop in plain sight. '
  + 'Read the short code on its sticker and type it here (leader submits).';

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
 * @param {object} [opts.scoring] clue4 scoring overrides
 * @param {Array<{startCode,waveId,localTeamNumber,answer,routeId?,startingPointId?,place?,stationCode?}>} opts.variants
 */
async function bulkSaveClue4({
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
  let startingPoints = startingPointsRaw.filter(
    (point) => String(point.roundId) === String(round._id),
  );
  if (!startingPoints.length) startingPoints = startingPointsRaw;

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
  const teamSize = Math.max(2, Math.min(8, Number(event.teamSize) || 4));
  const cluePrompt = String(prompt || '').trim() || SHARED_PROMPT;
  const { scoring: clue4Scoring } = await persistClueScoring({
    eventId,
    clueNumber: 4,
    scoring,
  });

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

      const waitIndex = waitIndexFromCode(startCode);
      const route = routeByCode.get(startCode)
        || routes.find((r) => String(r._id) === String(row.routeId || ''));
      const point = pointByCode.get(startCode)
        || startingPoints.find((p) => String(p._id) === String(row.startingPointId || ''));
      if (!route || !point) {
        errors.push({ startCode, waveId, message: 'Missing route or starting point' });
        continue;
      }

      const station = stationForLocalTeam(localTeamNumber, waitIndex, stations, 3);
      const place = row.place || station.name;
      const stationCode = String(row.stationCode || station.code || '').toUpperCase().trim();
      const stationIndex = stations.findIndex((s) => String(s.code).toUpperCase() === stationCode);
      const answer = String(
        row.answer || propCodeForTeam(stationIndex >= 0 ? stationIndex : 0, localTeamNumber),
      ).trim().toUpperCase();
      if (!answer) {
        errors.push({ startCode, waveId, message: 'Prop code required' });
        continue;
      }

      const sharedCode = `ST-${stationCode}-4`;
      const fourthCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId, code: sharedCode },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            code: sharedCode,
            progressionKey: '4',
            checkpointNumber: 4,
            checkpointKey: `4-${stationCode}`,
            locationName: place,
            stationCode,
            publicInstruction:
              `Purple FOURTH SCAN at ${place}. One shared QR for this place. `
              + `All ${teamSize} team members scan, then enter your team code to unlock Final.`,
            sequence: 4,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
            capacityGuidance: 4,
            concurrencyGuidance: 'Shared station QR — about 4 teams visit across the event.',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const defaults = routeClueDefaults(4, place, teamSize);
      const variantKey = `${startCode}-${waveId}`;
      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId,
          routeId: route._id,
          challengeNumber: 4,
          variantKey,
        },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            fourthCheckpointId: fourthCheckpoint._id,
            challengeNumber: 4,
            type: 'timed_search',
            prompt: cluePrompt,
            answer,
            acceptedAnswers: [answer, answer.toLowerCase()],
            destinationInstruction: defaults.destinationInstruction,
            hintText: defaults.hintText,
            basePoints: clue4Scoring.basePoints,
            maxAttempts: clue4Scoring.maxAttempts,
            timerSeconds: clue4Scoring.timerSeconds,
            speedBonusBands: clue4Scoring.speedBonusBands,
            hintCost: clue4Scoring.hintCost,
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

  await CampusHuntChallenge.updateMany(
    { eventId, challengeNumber: 4, variantKey: 'DEFAULT' },
    { $set: { active: false } },
  );

  const sharedQr = await syncSharedStationQrs(event, round, routes);

  const sync = await resyncClue1TeamBindings({
    eventId,
    roundId: round._id,
    actor,
    reason: 'clue4_bulk_saved',
  });

  await writeAudit({
    eventId,
    ...actor,
    action: 'clue4_bulk_saved',
    targetType: 'round',
    targetId: round._id,
    after: {
      saved,
      errors: errors.length,
      fourthPostersBound: sync.fourthPostersBound,
      teamsUpdated: sync.updated,
      sharedQr,
    },
  });

  return {
    saved,
    expected: variants.length,
    errors,
    teamsUpdated: sync.updated,
    fourthPostersBound: sync.fourthPostersBound,
    scoring: clue4Scoring,
    sharedQr,
  };
}

module.exports = {
  bulkSaveClue4,
  SHARED_PROMPT,
};
