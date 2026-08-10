const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');

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

function normalizeStationList(input) {
  const byCode = new Map(
    DEFAULT_CAMPUS_STATIONS.map((station) => [station.code, { ...station }]),
  );
  (Array.isArray(input) ? input : []).forEach((row) => {
    const code = String(row?.code || '').toUpperCase().trim();
    const name = String(row?.name || '').trim();
    if (!byCode.has(code) || !name) return;
    byCode.set(code, { code, name });
  });
  return DEFAULT_CAMPUS_STATIONS.map((station) => byCode.get(station.code));
}

function resolveCampusStations(event) {
  return normalizeStationList(event?.campusStations);
}

function replacePlaceText(text, oldName, newName) {
  if (text == null || !oldName || oldName === newName) return text;
  const escaped = String(oldName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp(escaped, 'gi'), newName);
}

/**
 * Save custom names on the event and rename matching checkpoints + clues everywhere.
 */
async function updateCampusStations({ eventId, stations, actor = {}, reason = '' }) {
  const event = await CampusHuntEvent.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }

  const previous = resolveCampusStations(event);
  const next = normalizeStationList(stations);
  const renames = [];
  for (let i = 0; i < next.length; i += 1) {
    const oldName = previous[i].name;
    const newName = next[i].name;
    if (oldName !== newName) {
      renames.push({ code: next[i].code, oldName, newName });
    }
  }

  event.campusStations = next;
  await event.save();

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
    campusStations: next,
    renames,
    checkpointsUpdated,
    challengesUpdated,
    actor,
    reason,
  };
}

module.exports = {
  DEFAULT_CAMPUS_STATIONS,
  normalizeStationList,
  resolveCampusStations,
  updateCampusStations,
  replacePlaceText,
};
