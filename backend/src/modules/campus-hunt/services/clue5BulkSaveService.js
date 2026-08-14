/**
 * Bulk-save Clue 5 / Final (one collaborative challenge per start route) in one request.
 */

const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const { persistClueScoring } = require('./clueScoringPersistService');
const { routeClueDefaults, CLUE5_WORDS } = require('./round1BootstrapService');

/**
 * @param {object} opts
 * @param {string} opts.eventId
 * @param {string} opts.roundId
 * @param {object} [opts.actor]
 * @param {object} [opts.scoring]
 * @param {Array<{startCode,prompt?,answer?,memberPrompts?,destinationInstruction?,routeId?,startingPointId?}>} opts.routes
 */
async function bulkSaveClue5({
  eventId,
  roundId,
  actor = {},
  scoring = {},
  routes: routeRows = [],
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

  const teamSize = Math.max(2, Math.min(8, Number(event.teamSize) || 4));
  const { scoring: clue5Scoring } = await persistClueScoring({
    eventId,
    clueNumber: 5,
    scoring,
  });

  let saved = 0;
  const errors = [];

  for (const row of routeRows) {
    try {
      const startCode = String(row.startCode || '').toUpperCase().trim();
      if (!/^[A-D]$/.test(startCode)) {
        errors.push({ row, message: 'Invalid startCode' });
        continue;
      }

      const route = routeByCode.get(startCode)
        || routes.find((r) => String(r._id) === String(row.routeId || ''));
      const point = pointByCode.get(startCode)
        || startingPoints.find((p) => String(p._id) === String(row.startingPointId || ''));
      if (!route || !point) {
        errors.push({ startCode, message: 'Missing route or starting point' });
        continue;
      }

      const finishWord = CLUE5_WORDS[startCode] || 'QUEST';
      const startName = point.name || startCode;
      const defaults = routeClueDefaults(5, finishWord, teamSize);
      defaults.destinationInstruction =
        `Report to your start — ${startName}. Ask the organizer to mark your team reached.`;

      const answer = String(row.answer || finishWord).trim().toUpperCase();
      const memberPrompts = Array.isArray(row.memberPrompts)
        ? row.memberPrompts.slice(0, teamSize).map((v) => String(v || '').trim())
        : defaults.memberPrompts;
      while (memberPrompts.length < teamSize) memberPrompts.push('');

      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId,
          routeId: route._id,
          challengeNumber: 5,
          variantKey: 'DEFAULT',
        },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            challengeNumber: 5,
            type: 'collaborative',
            prompt: String(row.prompt || defaults.prompt).trim(),
            memberPrompts,
            answer,
            acceptedAnswers: [answer, answer.toLowerCase()],
            destinationInstruction: String(
              row.destinationInstruction || defaults.destinationInstruction,
            ).trim(),
            hintText: defaults.hintText,
            basePoints: clue5Scoring.basePoints,
            maxAttempts: clue5Scoring.maxAttempts,
            timerSeconds: clue5Scoring.timerSeconds,
            speedBonusBands: clue5Scoring.speedBonusBands || [],
            hintCost: clue5Scoring.hintCost,
            difficulty: 'hard',
            variantKey: 'DEFAULT',
            active: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      saved += 1;
    } catch (error) {
      errors.push({
        startCode: row.startCode,
        message: error.message || 'Save failed',
      });
    }
  }

  await writeAudit({
    eventId,
    ...actor,
    action: 'clue5_bulk_saved',
    targetType: 'round',
    targetId: round._id,
    after: { saved, errors: errors.length },
  });

  return {
    saved,
    expected: routeRows.length,
    errors,
    scoring: clue5Scoring,
  };
}

module.exports = {
  bulkSaveClue5,
};
