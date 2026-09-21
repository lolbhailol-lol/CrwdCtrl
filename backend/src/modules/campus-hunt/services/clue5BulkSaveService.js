/**
 * Bulk-save Clue 5 — unique letter-word per team (start + wave variants).
 */

const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const { persistClueScoring } = require('./clueScoringPersistService');
const { writeAudit } = require('./auditService');
const { resyncClue1TeamBindings } = require('./startScheduleService');
const {
  routeClueDefaults,
  CLUE5_WORDS,
  clue5WordForTeam,
} = require('./round1BootstrapService');

function normalizeWaveId(waveId, localTeamNumber) {
  if (waveId) return String(waveId).toUpperCase().trim();
  const n = Number(localTeamNumber) || 1;
  return `T${n}`;
}

function waitIndexFromCode(startCode) {
  const code = String(startCode || 'A').toUpperCase().charAt(0);
  return Math.max(0, 'ABCD'.indexOf(code));
}

/**
 * @param {object} opts
 * @param {Array<{startCode,waveId?,localTeamNumber?,prompt?,answer?,routeId?,startingPointId?}>} [opts.variants]
 * @param {Array} [opts.routes] legacy one-word-per-start (expanded to per-team)
 */
async function bulkSaveClue5({
  eventId,
  roundId,
  actor = {},
  scoring = {},
  variants: variantRows = [],
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

  const teamSize = Math.max(2, Math.min(12, Number(event.teamSize) || 4));
  const teamsPerWait = Math.max(
    1,
    Math.ceil((Number(event.teamCapacity) || 20) / Math.max(1, startingPoints.length || 1)),
  );
  const { scoring: clue5Scoring } = await persistClueScoring({
    eventId,
    clueNumber: 5,
    scoring,
  });

  // Prefer explicit per-team variants; expand legacy routes into per-team rows.
  let rows = Array.isArray(variantRows) ? [...variantRows] : [];
  if (!rows.length && Array.isArray(routeRows) && routeRows.length) {
    for (const row of routeRows) {
      const startCode = String(row.startCode || '').toUpperCase().trim();
      const sharedWord = String(row.answer || CLUE5_WORDS[startCode] || 'QUEST')
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase();
      for (let local = 1; local <= teamsPerWait; local += 1) {
        rows.push({
          ...row,
          startCode,
          waveId: `T${local}`,
          localTeamNumber: local,
          answer: sharedWord || clue5WordForTeam(waitIndexFromCode(startCode), local, teamsPerWait),
        });
      }
    }
  }

  let saved = 0;
  const errors = [];
  const usedWords = new Set();

  for (const row of rows) {
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

      const route = routeByCode.get(startCode)
        || routes.find((r) => String(r._id) === String(row.routeId || ''));
      const point = pointByCode.get(startCode)
        || startingPoints.find((p) => String(p._id) === String(row.startingPointId || ''));
      if (!route || !point) {
        errors.push({ startCode, waveId, message: 'Missing route or starting point' });
        continue;
      }

      const fallback = clue5WordForTeam(
        waitIndexFromCode(startCode),
        localTeamNumber,
        teamsPerWait,
      );
      const answer = String(row.answer || fallback)
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase() || fallback;
      if (answer.length < 3) {
        errors.push({ startCode, waveId, message: 'Clue 5 word needs at least 3 letters' });
        continue;
      }
      if (usedWords.has(answer)) {
        errors.push({
          startCode,
          waveId,
          message: `Word ${answer} already used — each team needs a unique letter word`,
        });
        continue;
      }
      usedWords.add(answer);

      const defaults = routeClueDefaults(5, answer, teamSize);
      const prompt = String(row.prompt || defaults.prompt).trim() || defaults.prompt;
      const variantKey = `${startCode}-${waveId}`;

      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId,
          routeId: route._id,
          challengeNumber: 5,
          variantKey,
        },
        {
          $set: {
            eventId,
            roundId: round._id,
            routeId: route._id,
            startingPointId: point._id,
            challengeNumber: 5,
            type: 'decode',
            prompt,
            memberPrompts: [],
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

  // Retire legacy shared DEFAULT Clue 5 rows once per-team variants exist.
  if (saved > 0) {
    await CampusHuntChallenge.updateMany(
      { eventId, challengeNumber: 5, variantKey: 'DEFAULT' },
      { $set: { active: false } },
    );
  }

  const sync = await resyncClue1TeamBindings({
    eventId,
    roundId: round._id,
    actor,
    reason: 'clue5_bulk_saved',
  });

  await writeAudit({
    eventId,
    ...actor,
    action: 'clue5_bulk_saved',
    targetType: 'round',
    targetId: round._id,
    after: { saved, errors: errors.length, teamsUpdated: sync.updated },
  });

  return {
    saved,
    expected: rows.length,
    errors,
    teamsUpdated: sync.updated,
    scoring: clue5Scoring,
  };
}

module.exports = {
  bulkSaveClue5,
};
