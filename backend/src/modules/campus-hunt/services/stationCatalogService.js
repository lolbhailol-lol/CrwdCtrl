const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');

/** Default 10 hunt scan places (not wait holds). */
const DEFAULT_CAMPUS_STATIONS = [
  { code: 'S01', name: 'Food Court' },
  { code: 'S02', name: 'Amphitheatre' },
  { code: 'S03', name: 'Main Gate' },
  { code: 'S04', name: 'Sports Complex' },
  { code: 'S05', name: 'Student Centre' },
  { code: 'S06', name: 'Auditorium' },
  { code: 'S07', name: 'Cafeteria Lawn' },
  { code: 'S08', name: 'Innovation Lab' },
  { code: 'S09', name: 'Quad Fountain' },
  { code: 'S10', name: 'Admin Block' },
];

const DEFAULT_CAMPUS_STARTS = [
  { code: 'A', name: 'Library' },
  { code: 'B', name: 'Chanakya Porch' },
  { code: 'C', name: 'Design' },
  { code: 'D', name: 'Vyas Parking' },
];

function clampCount(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeStationList(input) {
  const byCode = new Map(
    DEFAULT_CAMPUS_STATIONS.map((station) => [station.code, { ...station }]),
  );
  (Array.isArray(input) ? input : []).forEach((row) => {
    const code = String(row?.code || '').toUpperCase().trim();
    const name = String(row?.name || '').trim();
    if (!byCode.has(code) || !name) return;
    const plantFragments = Array.isArray(row.plantFragments)
      ? row.plantFragments.map((f) => String(f || '').trim()).filter(Boolean)
      : undefined;
    const joinedWord = String(row.joinedWord || '').trim();
    byCode.set(code, {
      code,
      name,
      ...(plantFragments?.length ? { plantFragments } : {}),
      ...(joinedWord ? { joinedWord } : {}),
    });
  });
  return DEFAULT_CAMPUS_STATIONS.map((station) => byCode.get(station.code));
}

/** Normalize wait code from A / START-A / similar (matches startScheduleService). */
function normalizeWaitCode(rawInput) {
  const raw = String(rawInput || '').toUpperCase().trim();
  if (/^[A-D]$/.test(raw)) return raw;
  const stripped = raw.replace(/^START[-_\s]?/, '');
  if (/^[A-D]$/.test(stripped)) return stripped;
  return raw.match(/^([A-D])/)?.[1] || null;
}

function normalizeStartList(input) {
  const byCode = new Map(
    DEFAULT_CAMPUS_STARTS.map((start) => [start.code, { ...start }]),
  );
  (Array.isArray(input) ? input : []).forEach((row) => {
    const code = normalizeWaitCode(row?.code);
    const name = String(row?.name || '').trim();
    if (!code || !byCode.has(code) || !name) return;
    byCode.set(code, { code, name });
  });
  return DEFAULT_CAMPUS_STARTS.map((start) => byCode.get(start.code));
}

function resolveStationCount(event) {
  return clampCount(event?.stationCount, 1, DEFAULT_CAMPUS_STATIONS.length, DEFAULT_CAMPUS_STATIONS.length);
}

function resolveStartCount(event) {
  return clampCount(event?.startCount, 1, DEFAULT_CAMPUS_STARTS.length, DEFAULT_CAMPUS_STARTS.length);
}

/** Active hunt places for this event (first stationCount). */
function resolveCampusStations(event) {
  const full = normalizeStationList(event?.campusStations);
  return full.slice(0, resolveStationCount(event));
}

/** Full catalog with custom names (for admin rename UI). */
function resolveCampusStationsCatalog(event) {
  return normalizeStationList(event?.campusStations);
}

/** Active starting points for this event (first startCount). */
function resolveCampusStarts(event) {
  const full = normalizeStartList(event?.campusStarts);
  return full.slice(0, resolveStartCount(event));
}

function resolveCampusStartsCatalog(event) {
  return normalizeStartList(event?.campusStarts);
}

function replacePlaceText(text, oldName, newName) {
  if (text == null || !oldName || oldName === newName) return text;
  const escaped = String(oldName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp(escaped, 'gi'), newName);
}

/**
 * Save custom names / active counts and rename matching checkpoints + clues.
 */
async function updateCampusStations({
  eventId,
  stations,
  starts,
  stationCount,
  startCount,
  actor = {},
  reason = '',
}) {
  const event = await CampusHuntEvent.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }

  const previous = resolveCampusStationsCatalog(event);
  const next = stations != null ? normalizeStationList(stations) : previous;
  const previousStarts = resolveCampusStartsCatalog(event);
  const nextStarts = starts != null ? normalizeStartList(starts) : previousStarts;
  const nextStationCount = stationCount != null
    ? clampCount(stationCount, 1, DEFAULT_CAMPUS_STATIONS.length, resolveStationCount(event))
    : resolveStationCount(event);
  const nextStartCount = startCount != null
    ? clampCount(startCount, 1, DEFAULT_CAMPUS_STARTS.length, resolveStartCount(event))
    : resolveStartCount(event);

  const renames = [];
  for (let i = 0; i < next.length; i += 1) {
    const oldName = previous[i].name;
    const newName = next[i].name;
    if (oldName !== newName) {
      renames.push({ code: next[i].code, oldName, newName });
    }
  }

  event.campusStations = next;
  event.campusStarts = nextStarts;
  event.stationCount = nextStationCount;
  event.startCount = nextStartCount;
  await event.save();

  // Keep live starting-point docs in sync with active names / count.
  for (let i = 0; i < DEFAULT_CAMPUS_STARTS.length; i += 1) {
    const start = nextStarts[i];
    const active = i < nextStartCount;
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntStartingPoint.updateMany(
      { eventId: event._id, code: start.code },
      {
        $set: {
          name: start.name,
          active,
          displayOrder: i,
        },
      },
    );
  }

  let checkpointsUpdated = 0;
  let challengesUpdated = 0;

  for (const rename of renames) {
    // Prefer stationCode when present
    // eslint-disable-next-line no-await-in-loop
    const coded = await CampusHuntCheckpoint.find({ eventId, stationCode: rename.code });
    for (const row of coded) {
      row.locationName = rename.newName;
      row.publicInstruction = replacePlaceText(
        row.publicInstruction,
        rename.oldName,
        rename.newName,
      );
      // eslint-disable-next-line no-await-in-loop
      await row.save();
      checkpointsUpdated += 1;
    }

    // Legacy rows: match previous display name
    // eslint-disable-next-line no-await-in-loop
    const named = await CampusHuntCheckpoint.find({
      eventId,
      locationName: rename.oldName,
      $or: [
        { stationCode: { $exists: false } },
        { stationCode: null },
        { stationCode: '' },
      ],
    });
    for (const row of named) {
      row.locationName = rename.newName;
      row.stationCode = rename.code;
      row.publicInstruction = replacePlaceText(
        row.publicInstruction,
        rename.oldName,
        rename.newName,
      );
      // eslint-disable-next-line no-await-in-loop
      await row.save();
      checkpointsUpdated += 1;
    }

    // Answers/hints are select:false — must include them or rename won't touch player answers.
    // eslint-disable-next-line no-await-in-loop
    const challenges = await CampusHuntChallenge.find({ eventId })
      .select('+answer +acceptedAnswers +hintText');
    for (const challenge of challenges) {
      const before = JSON.stringify({
        answer: challenge.answer,
        prompt: challenge.prompt,
        destinationInstruction: challenge.destinationInstruction,
        hintText: challenge.hintText,
        acceptedAnswers: challenge.acceptedAnswers,
        memberPrompts: challenge.memberPrompts,
      });
      challenge.answer = replacePlaceText(challenge.answer, rename.oldName, rename.newName);
      challenge.prompt = replacePlaceText(challenge.prompt, rename.oldName, rename.newName);
      challenge.destinationInstruction = replacePlaceText(
        challenge.destinationInstruction,
        rename.oldName,
        rename.newName,
      );
      challenge.hintText = replacePlaceText(challenge.hintText, rename.oldName, rename.newName);
      if (Array.isArray(challenge.acceptedAnswers)) {
        challenge.acceptedAnswers = challenge.acceptedAnswers.map((item) => (
          replacePlaceText(String(item), rename.oldName, rename.newName)
        ));
      }
      if (Array.isArray(challenge.memberPrompts)) {
        challenge.memberPrompts = challenge.memberPrompts.map((item) => (
          replacePlaceText(String(item || ''), rename.oldName, rename.newName)
        ));
      }
      const after = JSON.stringify({
        answer: challenge.answer,
        prompt: challenge.prompt,
        destinationInstruction: challenge.destinationInstruction,
        hintText: challenge.hintText,
        acceptedAnswers: challenge.acceptedAnswers,
        memberPrompts: challenge.memberPrompts,
      });
      if (before !== after) {
        // eslint-disable-next-line no-await-in-loop
        await challenge.save();
        challengesUpdated += 1;
      }
    }
  }

  return {
    event,
    campusStations: resolveCampusStations(event),
    campusStationsCatalog: next,
    campusStarts: resolveCampusStarts(event),
    campusStartsCatalog: nextStarts,
    stationCount: nextStationCount,
    startCount: nextStartCount,
    renames,
    checkpointsUpdated,
    challengesUpdated,
    actor,
    reason,
  };
}

module.exports = {
  DEFAULT_CAMPUS_STATIONS,
  DEFAULT_CAMPUS_STARTS,
  normalizeStationList,
  normalizeStartList,
  normalizeWaitCode,
  resolveStationCount,
  resolveStartCount,
  resolveCampusStations,
  resolveCampusStationsCatalog,
  resolveCampusStarts,
  resolveCampusStartsCatalog,
  updateCampusStations,
  replacePlaceText,
};
