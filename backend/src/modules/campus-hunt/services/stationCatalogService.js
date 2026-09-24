const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');

/**
 * Default 20 hunt scan places — Neurosprint 25 (last year) shortlist.
 * Matches frontend CAMPUS_STATIONS S01–S20. `riddle` feeds Clue 1 prompts.
 */
const DEFAULT_CAMPUS_STATIONS = [
  {
    code: 'S01',
    name: 'JET ENGINE',
    zone: 'north',
    riddle:
      'I roar without a voice, I fly without wings,\n'
      + 'Fuel and thrust are my favorite things.\n'
      + 'I don’t move now, but once I could soar,\n'
      + 'Find me to start your hunt and explore.',
  },
  {
    code: 'S05',
    name: 'MATHEMATICS DEPARTMENT',
    zone: 'south',
    riddle:
      'Where numbers speak and symbols play,\n'
      + 'Equations guide the learning way.\n'
      + 'A place of logic, sharp and bright,\n'
      + 'Your clue is waiting within your sight.',
  },
  {
    code: 'S02',
    name: 'ENTC BUILDING',
    zone: 'north',
    riddle:
      'Where signals travel and circuits hum,\n'
      + 'Behind where the parked cars come,\n'
      + 'Look not at the front, but behind the scene,\n'
      + 'Your next clue rests where machines convene.',
  },
  {
    code: 'S06',
    name: 'METALLURGY DEPARTMENT',
    zone: 'south',
    riddle:
      'Where iron rests and steel is strong,\n'
      + 'This garden has seen metals all along.\n'
      + 'Search near the bench where shade is cast,\n'
      + 'Your next clue waits — don’t walk past.',
  },
  {
    code: 'S03',
    name: 'BOAT CLUB CANTEEN',
    zone: 'north',
    riddle:
      'Hungry minds and hungry friends meet,\n'
      + 'By the waters, where you find a seat.\n'
      + 'Between snacks and sips so sweet,\n'
      + 'Search beneath the bench where two paths meet.',
  },
  {
    code: 'S07',
    name: 'GEOLOGY MUSEUM',
    zone: 'south',
    riddle:
      'Stones tell stories from ages ago,\n'
      + 'Fossils and crystals in quiet rows.\n'
      + 'Look near the corner where the old rocks stay,\n'
      + 'Your next clue will guide you on the way.',
  },
  {
    code: 'S04',
    name: 'CHEMISTRY LAB',
    zone: 'north',
    riddle:
      'Here flames can burn but not to cook,\n'
      + 'Colored solutions fill every nook.\n'
      + 'Where reactions bubble, fizz, and play,\n'
      + 'Find this place of science today.',
  },
  {
    code: 'S09',
    name: 'VISVESVARAYA STATUE',
    zone: 'south',
    riddle:
      'A mind of steel, a vision so wide,\n'
      + 'An engineer’s pride, standing outside.\n'
      + 'On this very campus, once he did stay,\n'
      + 'Find the statue that honors his day.',
  },
  {
    code: 'S10',
    name: 'BHAU INSTITUTE',
    zone: 'north',
    riddle:
      'Dreams take flight and ideas ignite,\n'
      + 'Here, startups are given the light.\n'
      + 'Built by alumni with vision so true,\n'
      + 'Find the hub where businesses grew.',
  },
  {
    code: 'S11',
    name: 'FOUNTAIN',
    zone: 'south',
    riddle:
      'I never rest, I never sleep,\n'
      + 'I bubble and rise, though I am deep.\n'
      + 'Find me where water likes to play,\n'
      + 'Your next clue splashes the way.',
  },
  {
    code: 'S14',
    name: 'ENTC GARDEN',
    zone: 'north',
    riddle:
      'Where three buildings form a gentle square,\n'
      + 'A gazebo waits in the open air.\n'
      + 'A quiet spot where people rest,\n'
      + 'Your clue is waiting — go find the best.',
  },
  {
    code: 'S12',
    name: 'LIBRARY',
    zone: 'south',
    riddle:
      'Where knowledge is kept in a silent hall,\n'
      + 'And students gather to answer learning’s call.\n'
      + 'Find the first column near the main grand door,\n'
      + 'A sturdy support that stands before.',
  },
  {
    code: 'S18',
    name: 'OLD CSE BUILDING',
    zone: 'north',
    riddle:
      'Where binary language was first understood,\n'
      + 'The place where the digital foundation stood.\n'
      + 'A classic old building, its age you can see,\n'
      + 'Go there to find your next mystery.',
  },
  {
    code: 'S13',
    name: 'FAB LAB',
    zone: 'south',
    riddle:
      'A workshop of wonders, tools abound,\n'
      + 'Where dreams take shape and parts are found.\n'
      + 'If you seek where makers play,\n'
      + 'Find the lab that builds today.',
  },
  {
    code: 'S15',
    name: 'ALUMNI ASSOCIATION',
    zone: 'south',
    riddle:
      'They studied here, they built their way,\n'
      + 'Their footprints guide us still today.\n'
      + 'In this place their stories stay,\n'
      + 'Find the clue where alumni lay.',
  },
  {
    code: 'S19',
    name: 'NCC',
    zone: 'north',
    riddle:
      'With discipline sharp and uniforms neat,\n'
      + 'Cadets march proudly with steady feet.\n'
      + 'If you can match their steps in line,\n'
      + 'The next clue you’ll surely find.',
  },
  {
    code: 'S16',
    name: 'GATE 2',
    zone: 'south',
    riddle:
      'Not the front, but still a way,\n'
      + 'Where shortcuts lead you out each day.\n'
      + 'Look for the clue where exits are few,\n'
      + 'And find what’s waiting just for you.',
  },
  {
    code: 'S08',
    name: 'SUBWAY',
    zone: 'common',
    riddle:
      'I run below the ground, yet I’m no train,\n'
      + 'A secret path through sun or rain.\n'
      + 'North and South I softly bind,\n'
      + 'Step inside and see what you find.',
  },
  {
    code: 'S17',
    name: 'XEROX CENTRE',
    zone: 'south',
    riddle:
      'Pages appear though none are written,\n'
      + 'A magic box where copies are given.\n'
      + 'Black and white or colored too,\n'
      + 'Find this place — it waits for you.',
  },
  {
    code: 'S20',
    name: 'CIVIL DEPARTMENT',
    zone: 'south',
    riddle:
      'Strong as stone, and built to last,\n'
      + 'The oldest branch, a link to the past.\n'
      + 'From bridges to roads, its wisdom flows,\n'
      + 'Find where the first foundation grows.',
  },
];

const DEFAULT_DESTINATION_NAME = 'Mindspark Lobby';

/**
 * Clue 2 · shared 3-digit answer per campus stop (COEP).
 * Plant slips = one digit each; teams join in order.
 */
const DEFAULT_STATION_DIGIT_CODES = {
  S01: '874',
  S02: '932',
  S03: '651',
  S04: '872',
  S05: '940',
  S06: '531',
  S07: '861',
  S08: '957',
  S09: '420',
  S10: '663',
  S11: '731',
  S12: '850',
  S13: '942',
  S14: '710',
  S15: '864',
  S16: '953',
  S17: '421',
  S18: '765',
  S19: '830',
  S20: '952',
};

/** @deprecated alias — Clue 2 uses digits */
const DEFAULT_STATION_JOINED_WORDS = DEFAULT_STATION_DIGIT_CODES;

function splitDigitSlips(digitAnswer, slipCount = 3) {
  const digits = String(digitAnswer || '').replace(/\D/g, '');
  const n = Math.max(3, Math.min(12, Number(slipCount) || digits.length || 3));
  const padded = (digits || '847').padEnd(n, '0').slice(0, n);
  return Array.from({ length: n }, (_, i) => padded[i] || '0');
}

/** Clue 5 letter split (not used for Clue 2 stations). */
function splitPlantFragments(joinedWord, teamSize = 4) {
  const people = Math.max(2, Math.min(12, Number(teamSize) || 4));
  const raw = String(joinedWord || 'QUEST').replace(/[^A-Za-z]/g, '').toUpperCase() || 'QUEST';
  const len = Math.max(people, raw.length);
  const padded = raw.padEnd(len, 'X');
  const size = Math.ceil(padded.length / people);
  return Array.from({ length: people }, (_, i) => (
    padded.slice(i * size, (i + 1) * size) || 'X'
  ));
}

/** Fill missing joinedWord + plantFragments for a station list (Clue 2 digits). */
function withStationPlantDefaults(stations, teamSize = 4) {
  void teamSize;
  return (Array.isArray(stations) ? stations : []).map((row) => {
    const code = String(row?.code || '').toUpperCase().trim();
    let joinedWord = String(row?.joinedWord || DEFAULT_STATION_DIGIT_CODES[code] || '')
      .replace(/\D/g, '');
    if (!joinedWord || joinedWord.length < 3) {
      joinedWord = DEFAULT_STATION_DIGIT_CODES[code] || '847';
    }
    joinedWord = joinedWord.slice(0, 3).padStart(3, '0');
    const existing = Array.isArray(row?.plantFragments)
      ? row.plantFragments.map((f) => String(f || '').replace(/\D/g, '')).filter(Boolean)
      : [];
    const allDigits = existing.length >= 3 && existing.every((f) => /^\d+$/.test(f));
    const plantFragments = allDigits
      ? existing.slice(0, 3)
      : splitDigitSlips(joinedWord, 3);
    return {
      ...row,
      code,
      joinedWord,
      plantFragments,
    };
  });
}

async function syncStationPlantsToCheckpoints(eventId, stations) {
  let updated = 0;
  for (const row of stations || []) {
    const code = String(row?.code || '').toUpperCase().trim();
    if (!code) continue;
    const plantFragments = Array.isArray(row.plantFragments)
      ? row.plantFragments.map((f) => String(f || '').trim()).filter(Boolean)
      : [];
    const joinedWord = String(row.joinedWord || '').replace(/\D/g, '').slice(0, 3);
    if (!plantFragments.length && !joinedWord) continue;
    // eslint-disable-next-line no-await-in-loop
    const result = await CampusHuntCheckpoint.updateMany(
      { eventId, stationCode: code },
      {
        $set: {
          ...(plantFragments.length ? { plantFragments } : {}),
          ...(joinedWord ? { joinedWord } : {}),
        },
      },
    );
    updated += result.modifiedCount || 0;
  }
  return updated;
}

/** Ensure event catalog has 3-digit answers + digit slips. */
async function ensureEventStationPlants(event, { force = false } = {}) {
  const teamSize = Math.max(2, Math.min(12, Number(event?.teamSize) || 4));
  const current = normalizeStationList(event?.campusStations);
  const next = withStationPlantDefaults(
    current.map((row) => {
      if (!force) return row;
      const code = String(row.code || '').toUpperCase();
      const joinedWord = DEFAULT_STATION_DIGIT_CODES[code] || '847';
      return {
        ...row,
        joinedWord,
        plantFragments: splitDigitSlips(joinedWord, 3),
      };
    }),
    teamSize,
  );
  event.campusStations = next;
  event.markModified?.('campusStations');
  await event.save();
  const synced = await syncStationPlantsToCheckpoints(event._id, next);
  return {
    stations: resolveCampusStations(event),
    catalog: next,
    checkpointsSynced: synced,
    teamSize,
  };
}

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
      ? row.plantFragments.map((f) => String(f || '').replace(/\D/g, '')).filter(Boolean)
      : undefined;
    let joinedWord = String(row.joinedWord || DEFAULT_STATION_DIGIT_CODES[code] || '')
      .replace(/\D/g, '');
    if (!joinedWord || joinedWord.length < 3) {
      joinedWord = DEFAULT_STATION_DIGIT_CODES[code] || '847';
    }
    joinedWord = joinedWord.slice(0, 3).padStart(3, '0');
    const zone = String(row.zone || '').trim();
    const riddle = String(row.riddle || '').trim();
    const prev = byCode.get(code);
    const frags = plantFragments?.length >= 3 && plantFragments.every((f) => /^\d+$/.test(f))
      ? plantFragments.slice(0, 3)
      : splitDigitSlips(joinedWord, 3);
    byCode.set(code, {
      code,
      name,
      zone: zone || prev.zone,
      riddle: riddle || prev.riddle,
      joinedWord,
      plantFragments: frags,
    });
  });
  return DEFAULT_CAMPUS_STATIONS.map((station) => {
    const row = byCode.get(station.code);
    let joinedWord = String(row.joinedWord || DEFAULT_STATION_DIGIT_CODES[station.code] || '')
      .replace(/\D/g, '');
    if (!joinedWord || joinedWord.length < 3) {
      joinedWord = DEFAULT_STATION_DIGIT_CODES[station.code] || '847';
    }
    joinedWord = joinedWord.slice(0, 3).padStart(3, '0');
    const plantFragments = Array.isArray(row.plantFragments)
      && row.plantFragments.length >= 3
      && row.plantFragments.every((f) => /^\d+$/.test(String(f)))
      ? row.plantFragments.slice(0, 3).map((f) => String(f).replace(/\D/g, ''))
      : splitDigitSlips(joinedWord, 3);
    return { ...row, joinedWord, plantFragments };
  });
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

function resolveDestinationName(event) {
  return String(event?.destinationName || '').trim() || DEFAULT_DESTINATION_NAME;
}

const DEFAULT_ORGANIZER_FINISH_CODE = 'MSFINISH';

function resolveOrganizerFinishCode(event) {
  const raw = String(event?.organizerFinishCode || '').trim().toUpperCase();
  return raw || DEFAULT_ORGANIZER_FINISH_CODE;
}

/** Clue 1 prompt from Neurosprint riddle when the place is in the catalog. */
function clue1ForPlace(placeOrStation, teamSize = 4) {
  const code = typeof placeOrStation === 'object'
    ? String(placeOrStation?.code || '').toUpperCase().trim()
    : '';
  const nameHint = typeof placeOrStation === 'object'
    ? String(placeOrStation?.name || '').trim()
    : String(placeOrStation || '').trim();
  const catalog = DEFAULT_CAMPUS_STATIONS.find((s) => (
    (code && s.code === code)
    || s.name.toLowerCase() === nameHint.toLowerCase()
    || s.code.toLowerCase() === nameHint.toLowerCase()
  ));
  const name = nameHint || catalog?.name || 'the station';
  const people = Math.max(2, Math.min(12, Number(teamSize) || 4));
  const riddle = String(
    (typeof placeOrStation === 'object' && placeOrStation?.riddle)
    || catalog?.riddle
    || '',
  ).trim();
  return {
    prompt: riddle
      || (
        `Your first scan is waiting on campus. Read the marks, follow the crowd of clues, `
        + `and name the place: ${name}.`
      ),
    answer: name,
    acceptedAnswers: [name, catalog?.name].filter(Boolean)
      .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i),
    destinationInstruction:
      `Go to ${name}. Leader scans the shared QR once to unlock Clue 2.`,
    hintText: riddle
      ? `Think of a landmark that matches the poem — then go to ${name}.`
      : `Ask staff for the way to ${name}.`,
  };
}

module.exports = {
  DEFAULT_CAMPUS_STATIONS,
  DEFAULT_CAMPUS_STARTS,
  DEFAULT_DESTINATION_NAME,
  DEFAULT_ORGANIZER_FINISH_CODE,
  DEFAULT_STATION_JOINED_WORDS,
  DEFAULT_STATION_DIGIT_CODES,
  clampCount,
  normalizeStationList,
  normalizeWaitCode,
  normalizeStartList,
  resolveDestinationName,
  resolveOrganizerFinishCode,
  resolveStationCount,
  resolveStartCount,
  resolveCampusStations,
  resolveCampusStationsCatalog,
  resolveCampusStarts,
  resolveCampusStartsCatalog,
  clue1ForPlace,
  updateCampusStations,
  replacePlaceText,
  splitPlantFragments,
  splitDigitSlips,
  withStationPlantDefaults,
  syncStationPlantsToCheckpoints,
  ensureEventStationPlants,
};

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

  // Keep plant fragments / joined words on live checkpoint docs for offline packs.
  const plantsSynced = await syncStationPlantsToCheckpoints(event._id, next);

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
    plantsSynced,
    actor,
    reason,
  };
}
