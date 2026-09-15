/**
 * Round 1 defaults: 40 teams across 4 starting points (×10),
 * parallel 5-min releases, 4 clues → 10 campus checkpoint stations.
 *
 * Starting points (Library / Chanakya / Design / Vyas) are HOLD points only.
 * Hunt scans use a separate list of ~10 campus stations.
 * Each station has ONE shared QR per progression (CP1 / CP2 / CP3).
 * ~4 teams arrive per station across waves; all scan the same poster,
 * then confirm team code to unlock their allotted clue.
 */

const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const { DEFAULT_SCORING_CONFIG } = require('../constants');
const { provisionTeamRoster, repairAllTeamRostersForEvent } = require('./rosterProvisionService');
const { assertValidTeamRoster } = require('../utils/roster');
const { assertCapacityCounts } = require('./capacityService');
const { writeAudit } = require('./auditService');
const {
  DEFAULT_CAMPUS_STATIONS,
  resolveCampusStations,
  resolveCampusStarts,
  resolveStartCount,
} = require('./stationCatalogService');

const ROUTE_KEYS = ['A', 'B', 'C', 'D'];
const TARGET_TEAMS_PER_STATION = 4;
const TEAMS_PER_WAIT = 10;
const STATION_COUNT = DEFAULT_CAMPUS_STATIONS.length || 10;

function teamsPerWaitFor(capacity, startCount = ROUTE_KEYS.length) {
  const starts = Math.max(1, Math.min(ROUTE_KEYS.length, Number(startCount) || ROUTE_KEYS.length));
  return Math.max(1, Math.ceil((Number(capacity) || 40) / starts));
}

function teamsPerStationFor(capacity, stationCount = STATION_COUNT) {
  const stations = Math.max(1, Math.min(STATION_COUNT, Number(stationCount) || STATION_COUNT));
  return Math.max(1, Math.round((Number(capacity) || 40) / stations));
}

function buildTeamGroups(teamsPerWait = TEAMS_PER_WAIT) {
  const n = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  return Array.from({ length: n }, (_, i) => ({
    wave: `T${i + 1}`,
    teamLabel: `team ${i + 1}`,
    slot: i,
    localTeamNumber: i + 1,
  }));
}

/** 4 starting points only — teams hold here until release. */
const WAIT_POINTS = [
  { code: 'A', name: 'Library', description: 'Starting point — teams hold here until release.' },
  { code: 'B', name: 'Chanakya Porch', description: 'Starting point — teams hold here until release.' },
  { code: 'C', name: 'Design', description: 'Starting point — teams hold here until release.' },
  { code: 'D', name: 'Vyas Parking', description: 'Starting point — teams hold here until release.' },
];

/** Default hunt stations — prefer event.campusStations via resolveCampusStations. */
const HUNT_STATIONS = DEFAULT_CAMPUS_STATIONS;
const CAMPUS_STATIONS = HUNT_STATIONS;
const DEFAULT_LOCATIONS = WAIT_POINTS;

/** Local Team release slots (variant keys T1…Tn). Baseline: 10. */
const TEAM_GROUPS = buildTeamGroups(TEAMS_PER_WAIT);

function gcd(a, b) {
  let x = Math.abs(Number(a) || 0);
  let y = Math.abs(Number(b) || 0);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function coprimeStrides(stationCount) {
  const n = Math.max(1, Number(stationCount) || 1);
  const out = [];
  for (let s = 1; s < n; s += 1) {
    if (gcd(s, n) === 1) out.push(s);
  }
  return out.length ? out : [1];
}

function teamPathIndices(globalTeamIndex, stationCount, stopCount = 4) {
  const N = Math.max(1, Number(stationCount) || 1);
  const stops = Math.max(1, Math.min(N, Number(stopCount) || 4));
  const strides = coprimeStrides(N);
  const index = Math.max(0, Number(globalTeamIndex) || 0);
  const layer = Math.floor(index / N);
  const base = index % N;
  const stride = strides[layer % strides.length];
  const baseShift = Math.floor(layer / strides.length);
  const start = (base + baseShift) % N;
  const used = new Set();
  const path = [];
  for (let s = 0; s < stops; s += 1) {
    let idx = (start + s * stride) % N;
    let guard = 0;
    while (used.has(idx) && guard < N) {
      idx = (idx + 1) % N;
      guard += 1;
    }
    used.add(idx);
    path.push(idx);
  }
  return path;
}

function globalTeamIndex(waitIndex, localTeamNumber, teamsPerWait = TEAMS_PER_WAIT) {
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  const wait = Math.max(0, Number(waitIndex) || 0);
  const local = Math.max(1, Number(localTeamNumber) || 1);
  return wait * perWait + (local - 1);
}

/**
 * Unique Orange→Green→Blue→Purple path per team.
 * Start A uses stride +1; start B uses next coprime stride (e.g. +3 on 10 places)
 * so A·T2 and B·T1 no longer share the same route.
 */
function stationForLocalTeam(
  localTeamNumber,
  waitIndex = 0,
  stations = HUNT_STATIONS,
  stopOffset = 0,
  teamsPerWait = TEAMS_PER_WAIT,
) {
  const list = stations?.length ? stations : HUNT_STATIONS;
  if (!list.length) return null;
  const path = teamPathIndices(
    globalTeamIndex(waitIndex, localTeamNumber, teamsPerWait),
    list.length,
    4,
  );
  const step = Math.max(0, Math.min(path.length - 1, Number(stopOffset) || 0));
  return list[path[step]];
}

/** Stable unique 3-digit code for global team. */
function threeDigitCodeForTeam(waitIndex, localTeamNumber, teamsPerWait = TEAMS_PER_WAIT) {
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  const teamNumber = (Math.max(0, Number(waitIndex) || 0) * perWait)
    + Math.max(1, Number(localTeamNumber) || 1);
  return String(100 + ((teamNumber * 73 + 19) % 900)).padStart(3, '0');
}

function clue1ForPlace(place, teamSize = 4) {
  const name = place || 'the station';
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));
  return {
    prompt:
      `Your first scan is waiting on campus. Read the marks, follow the crowd of clues, `
      + `and name the place: ${name}.`,
    answer: name,
    destinationInstruction:
      `Go to ${name}. All ${people} members scan the shared QR, then enter your team code.`,
    hintText: `Ask staff for the way to ${name}.`,
  };
}

function splitIntoMemberCodes(word, teamSize = 4) {
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));
  const raw = String(word || 'QUEST').replace(/\s+/g, '').toUpperCase();
  const len = Math.max(people, raw.length);
  const padded = raw.padEnd(len, 'X');
  const size = Math.ceil(padded.length / people);
  return Array.from({ length: people }, (_, i) => (
    padded.slice(i * size, (i + 1) * size) || String(i + 1)
  ));
}

function routeClueDefaults(challengeNumber, destination, teamSize = 4) {
  const place = destination || 'the next station';
  const n = Number(challengeNumber) || 2;
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));

  if (n === 2) {
    return {
      prompt:
        'A staff mark hides in plain sight nearby. '
        + 'Scan the area at eye level — find your team’s 3-digit number.',
      answer: '',
      hintText: 'Check posts, pillars, and notice boards at eye level.',
      destinationInstruction:
        'Go to your next location now. Find the shared green SECOND SCAN QR — '
        + `all ${people} members scan, then enter your team code to unlock Clue 3.`,
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  if (n === 3) {
    const cipher = caesarShift(place, 3);
    return {
      prompt:
        `Letters have marched three steps forward. Decode this Caesar (+3) message:\n${cipher}`,
      answer: place,
      hintText: 'Caesar shift of 3 — A becomes D, B becomes E… Spaces stay spaces.',
      destinationInstruction:
        'Riddle solved — go find the shared blue THIRD SCAN QR at that place. '
        + `All ${people} members scan, then enter your team code to unlock the prop hunt.`,
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  if (n === 4) {
    // `place` is the destination station name; answer is the planted prop code (passed separately).
    return {
      prompt:
        `CRAZY PROP HUNT at ${place}.\n`
        + 'Hunt as a team for the silly planted prop (bright / weird object in plain sight). '
        + 'Read the short code on its sticker and type it here (leader submits).',
      answer: '',
      hintText: 'Look at eye / knee level near the purple QR zone — not on your phones.',
      destinationInstruction:
        `Prop found — stay at ${place}. Find the shared purple FOURTH SCAN QR. `
        + `All ${people} members scan, then enter your team code to unlock Final.`,
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  // Clue 5 / Final — collaborative one-word puzzle; `place` here is the finish word.
  const word = String(place || 'QUEST').replace(/\s+/g, '').toUpperCase();
  const chunks = splitIntoMemberCodes(word, people);
  return {
    prompt:
      'Each teammate has a code fragment on their phone. '
      + `Speak them in order 1→${people} and rebuild the one word. Leader submits it.`,
    answer: word,
    hintText: 'Say every code out loud in member order — no spaces in the final word.',
    destinationInstruction:
      'Word solved — report to your start location. Ask the organizer to mark your team reached.',
    memberPrompts: chunks,
  };
}

/** One-word answers per start path for Final (Clue 5). */
const CLUE5_WORDS = {
  A: 'QUEST',
  B: 'BLAZE',
  C: 'SPARK',
  D: 'PRIDE',
};

/** Planted prop sticker codes — rotate so routes don’t share the same word. */
const PROP_CODES = [
  'BANANA', 'WOOF', 'NEON', 'QUACK', 'SOCK', 'EGG', 'YEET', 'ZOOM',
  'BLOOP', 'ZAP', 'GOOF', 'BONK', 'YIKES', 'NOPE', 'YAY', 'BOOP',
];

function propCodeForTeam(stationIndex, localTeamNumber) {
  const i = (Number(stationIndex) || 0) * 11 + (Number(localTeamNumber) || 1);
  return PROP_CODES[Math.abs(i) % PROP_CODES.length];
}

/** @deprecated use CLUE5_WORDS */
const CLUE4_WORDS = CLUE5_WORDS;

/** Clue 1 first stops for local teams at a given wait (unique paths across starts). */
function rotatingFirstStops(waitIndex = 0, stations = HUNT_STATIONS, teamGroups = TEAM_GROUPS) {
  const perWait = teamGroups?.length || TEAMS_PER_WAIT;
  return teamGroups.map((group) => (
    stationForLocalTeam(group.localTeamNumber, waitIndex, stations, 0, perWait)
  ));
}

/** Checkpoint 2 / Clue 2 destinations — stride step 1 on each team's unique path. */
function rotatingSecondStops(waitIndex = 0, stations = HUNT_STATIONS, teamGroups = TEAM_GROUPS) {
  const perWait = teamGroups?.length || TEAMS_PER_WAIT;
  return teamGroups.map((group) => (
    stationForLocalTeam(group.localTeamNumber, waitIndex, stations, 1, perWait)
  ));
}

/** Checkpoint 3 destinations — stride step 2. */
function rotatingThirdStops(waitIndex = 0, stations = HUNT_STATIONS, teamGroups = TEAM_GROUPS) {
  const perWait = teamGroups?.length || TEAMS_PER_WAIT;
  return teamGroups.map((group) => (
    stationForLocalTeam(group.localTeamNumber, waitIndex, stations, 2, perWait)
  ));
}

/** Checkpoint 4 / prop hunt — stride step 3. */
function rotatingFourthStops(waitIndex = 0, stations = HUNT_STATIONS, teamGroups = TEAM_GROUPS) {
  const perWait = teamGroups?.length || TEAMS_PER_WAIT;
  return teamGroups.map((group) => (
    stationForLocalTeam(group.localTeamNumber, waitIndex, stations, 3, perWait)
  ));
}

function caesarShift(text, shift = 3) {
  return String(text || '').replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
  });
}

function padTeam(n) {
  return `CC${String(n).padStart(3, '0')}`;
}

async function ensureRound(event) {
  const { deriveCompetitionFormat } = require('../utils/competitionFormat');
  const format = deriveCompetitionFormat({
    teamCapacity: event.teamCapacity,
    teamSize: event.teamSize,
  });
  let round = await CampusHuntRound.findOne({ eventId: event._id, roundNumber: 1 });
  if (!round) {
    round = await CampusHuntRound.create({
      eventId: event._id,
      roundNumber: 1,
      name: 'THE_HUNT',
      status: 'scheduled',
      releaseIntervalMinutes: 5,
      assignmentStrategy: 'route_balanced',
      scheduleStatus: 'draft',
      qualification: format.qualification,
    });
  } else {
    if (!round.releaseIntervalMinutes || round.releaseIntervalMinutes < 1) {
      round.releaseIntervalMinutes = 5;
    }
    if (!round.assignmentStrategy) round.assignmentStrategy = 'route_balanced';
    round.qualification = {
      ...(round.qualification?.toObject?.() || round.qualification || {}),
      ...format.qualification,
    };
    await round.save();
  }
  return round;
}

async function ensureLocations(event, round, capacity = 10, startCount = 4) {
  const starts = resolveCampusStarts(event);
  const activeCodes = starts.map((s) => s.code);
  const points = [];
  for (let index = 0; index < starts.length; index += 1) {
    const loc = starts[index];
    const meta = DEFAULT_LOCATIONS.find((row) => row.code === loc.code) || loc;
    // eslint-disable-next-line no-await-in-loop
    const point = await CampusHuntStartingPoint.findOneAndUpdate(
      { eventId: event._id, code: loc.code },
      {
        $set: {
          eventId: event._id,
          roundId: round._id,
          code: loc.code,
          name: loc.name,
          description: meta.description || `Starting point — ${capacity} teams hold here until release.`,
          capacity,
          displayOrder: index,
          active: true,
        },
        $setOnInsert: { releasesPaused: false },
      },
      { upsert: true, new: true },
    );
    points.push(point);
  }
  // Retire unused starts (and legacy duplicates) so schedule uses only active layout.
  await CampusHuntStartingPoint.updateMany(
    {
      eventId: event._id,
      code: { $nin: activeCodes },
    },
    { $set: { active: false } },
  );
  return points;
}

async function ensureRoutes(event, teamCapacity = 40, startCount = 4) {
  const starts = Math.max(1, Math.min(ROUTE_KEYS.length, Number(startCount) || ROUTE_KEYS.length));
  const activeKeys = ROUTE_KEYS.slice(0, starts);
  const routes = [];
  const slots = Math.ceil(teamCapacity / starts);
  for (const key of activeKeys) {
    // eslint-disable-next-line no-await-in-loop
    const route = await CampusHuntRoute.findOneAndUpdate(
      { eventId: event._id, routeKey: key },
      {
        $set: {
          eventId: event._id,
          routeKey: key,
          name: `Route ${key}`,
          teamSlots: slots,
          active: true,
        },
      },
      { upsert: true, new: true },
    );
    routes.push(route);
  }
  await CampusHuntRoute.updateMany(
    {
      eventId: event._id,
      routeKey: { $nin: activeKeys },
    },
    { $set: { active: false } },
  );
  return routes;
}

/**
 * One shared checkpoint QR per campus station × progression (1/2/3).
 * Anchored on the first route for schema routeId; eligibility ignores route for these.
 */
async function ensureSharedStationCheckpoints(event, round, anchorRoute, stations, capacity) {
  const map = new Map();
  let created = 0;
  const stages = [
    { key: '1', num: 1, seq: 1, label: 'orange FIRST SCAN' },
    { key: '2', num: 2, seq: 2, label: 'green SECOND SCAN' },
    { key: '3', num: 3, seq: 3, label: 'blue THIRD SCAN' },
    { key: '4', num: 4, seq: 4, label: 'purple FOURTH SCAN' },
  ];
  for (const station of stations) {
    for (const prog of stages) {
      const checkpointKey = `${prog.key}-${station.code}`;
      const code = `ST-${station.code}-${prog.key}`;
      // eslint-disable-next-line no-await-in-loop
      const cp = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId: event._id, code },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: anchorRoute._id,
            code,
            progressionKey: prog.key,
            checkpointNumber: prog.num,
            checkpointKey,
            locationName: station.name,
            stationCode: station.code,
            publicInstruction:
              `${prog.label} at ${station.name}. One shared QR for this place. `
              + `All ${Math.max(2, Math.min(8, Number(event.teamSize) || 4))} team members scan, `
              + 'then enter your team code to unlock your allotted clue.',
            sequence: prog.seq,
            capacityGuidance: capacity,
            concurrencyGuidance:
              `Shared station QR — about ${TARGET_TEAMS_PER_STATION} teams visit this place across the event.`,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
            allowedTeamIds: [],
          },
        },
        { upsert: true, new: true },
      );
      map.set(`${prog.key}:${station.code}`, cp);
      created += 1;
    }
  }

  // Retire legacy team-bound wave posters (R{A}-1-T1, etc.)
  const retired = await CampusHuntCheckpoint.updateMany(
    {
      eventId: event._id,
      roundId: round._id,
      progressionKey: { $in: ['1', '2', '3', '4'] },
      code: { $not: /^ST-/i },
    },
    {
      $set: {
        active: false,
        concurrencyGuidance: 'Retired — replaced by one shared ST-{station}-N QR per place.',
      },
    },
  );

  // Hide shared QRs for campus places no longer in the active hunt layout.
  const activeStationCodes = new Set(
    stations.map((row) => String(row.code || '').toUpperCase().trim()).filter(Boolean),
  );
  const inactiveStationCodes = DEFAULT_CAMPUS_STATIONS
    .map((row) => row.code)
    .filter((code) => !activeStationCodes.has(code));
  let retiredInactiveStations = 0;
  if (inactiveStationCodes.length) {
    const retiredInactive = await CampusHuntCheckpoint.updateMany(
      {
        eventId: event._id,
        progressionKey: { $in: ['1', '2', '3', '4'] },
        code: { $regex: /^ST-/i },
        stationCode: { $in: inactiveStationCodes },
      },
      {
        $set: {
          active: false,
          concurrencyGuidance: 'Retired — campus place removed from active hunt layout.',
        },
      },
    );
    retiredInactiveStations = retiredInactive.modifiedCount || 0;
  }

  return {
    map,
    created,
    retired: (retired.modifiedCount || 0) + retiredInactiveStations,
  };
}

async function ensureCheckpointsAndClues(
  event,
  round,
  routes,
  startingPoints,
  capacity = TARGET_TEAMS_PER_STATION,
  huntStations = HUNT_STATIONS,
  teamGroups = TEAM_GROUPS,
  teamsPerWait = TEAMS_PER_WAIT,
  onlyChallengeNumbers = null,
) {
  const scoring = event.scoringConfig || DEFAULT_SCORING_CONFIG;
  const stations = huntStations?.length ? huntStations : HUNT_STATIONS;
  let checkpointCount = 0;
  let clueCount = 0;
  const pointsByCode = new Map(
    startingPoints.map((point) => [String(point.code || '').toUpperCase(), point]),
  );
  const only = Array.isArray(onlyChallengeNumbers)
    ? new Set(onlyChallengeNumbers.map((n) => Number(n)).filter((n) => n >= 1 && n <= 5))
    : null;
  const wantClue = (n) => !only || only.has(Number(n));

  if (!routes.length) {
    return { checkpointCount: 0, clueCount: 0, retiredWaitNamedCheckpoints: 0 };
  }

  const shared = await ensureSharedStationCheckpoints(
    event,
    round,
    routes[0],
    stations,
    capacity,
  );
  checkpointCount += shared.created;

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex];
    const key = route.routeKey;
    const startIndex = ROUTE_KEYS.indexOf(key);
    const stationIndex = startIndex >= 0 ? startIndex : routeIndex;
    const startStation = (resolveCampusStarts(event)[stationIndex]
      || WAIT_POINTS[stationIndex]
      || WAIT_POINTS[0]);
    const startingPoint = pointsByCode.get(startStation.code) || startingPoints[stationIndex];
    const firstStops = rotatingFirstStops(stationIndex, stations, teamGroups);
    const secondStops = rotatingSecondStops(stationIndex, stations, teamGroups);
    const thirdStops = rotatingThirdStops(stationIndex, stations, teamGroups);
    const fourthStops = rotatingFourthStops(stationIndex, stations, teamGroups);
    const finishWord = CLUE5_WORDS[key] || CLUE4_WORDS[key] || 'QUEST';
    const startName = startStation.name;

    const firstStopDefs = teamGroups.map((group) => ({
      wave: group.wave,
      teamLabel: group.teamLabel,
      localTeamNumber: group.localTeamNumber,
      station: firstStops[group.slot],
      key: `1-${group.wave}`,
    }));

    const secondStopDefs = teamGroups.map((group) => ({
      wave: group.wave,
      teamLabel: group.teamLabel,
      localTeamNumber: group.localTeamNumber,
      station: secondStops[group.slot],
      key: `2-${group.wave}`,
      code: threeDigitCodeForTeam(stationIndex, group.localTeamNumber, teamsPerWait),
    }));

    const thirdStopDefs = teamGroups.map((group) => ({
      wave: group.wave,
      teamLabel: group.teamLabel,
      localTeamNumber: group.localTeamNumber,
      station: thirdStops[group.slot],
      key: `3-${group.wave}`,
    }));

    const fourthStopDefs = teamGroups.map((group) => ({
      wave: group.wave,
      teamLabel: group.teamLabel,
      localTeamNumber: group.localTeamNumber,
      station: fourthStops[group.slot],
      key: `4-${group.wave}`,
      propCode: propCodeForTeam(stationIndex, group.localTeamNumber),
    }));

    const laterDefs = [
      {
        key: 'FINISH',
        num: 5,
        seq: 5,
        station: startStation,
        instruction:
          `Finish at ${startName} (your start). `
          + 'Ask the organizer to mark your team reached — score locks when marked.',
      },
    ];

    for (const first of firstStopDefs) {
      if (!wantClue(1)) break;
      const firstCheckpoint = shared.map.get(`1:${first.station.code}`);
      if (!startingPoint || !firstCheckpoint) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const variantKey = `${startStation.code}-${first.wave}`;
      const people = Math.max(2, Math.min(8, Number(event.teamSize) || 4));
      const clue1 = clue1ForPlace(first.station.name, people);
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId: event._id,
          roundId: round._id,
          routeId: route._id,
          challengeNumber: 1,
          variantKey,
        },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint._id,
            firstCheckpointId: firstCheckpoint._id,
            challengeNumber: 1,
            type: 'navigation',
            prompt: clue1.prompt,
            answer: clue1.answer,
            acceptedAnswers: [
              first.station.code.toLowerCase(),
              first.station.name.toLowerCase(),
            ],
            destinationInstruction:
              `Go to ${first.station.name}. All ${people} members scan the shared orange QR, `
              + 'then enter your team code to unlock Clue 2.',
            basePoints: scoring.clue1?.basePoints ?? DEFAULT_SCORING_CONFIG.clue1.basePoints ?? 50,
            maxAttempts: scoring.clue1?.maxAttempts || 3,
            timerSeconds: 0,
            hintText: clue1.hintText,
            hintCost: scoring.hintCost || 15,
            difficulty: 'medium',
            variantKey,
            active: true,
          },
        },
        { upsert: true },
      );
      clueCount += 1;
    }

    // Clue 2 variants → shared green SECOND SCAN QR at next station
    for (const second of secondStopDefs) {
      if (!wantClue(2)) break;
      const secondCheckpoint = shared.map.get(`2:${second.station.code}`);
      if (!startingPoint || !secondCheckpoint) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const variantKey = `${startStation.code}-${second.wave}`;
      const clue2Defaults = routeClueDefaults(2, second.station.name, event.teamSize);
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId: event._id,
          roundId: round._id,
          routeId: route._id,
          challengeNumber: 2,
          variantKey,
        },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint._id,
            secondCheckpointId: secondCheckpoint._id,
            challengeNumber: 2,
            type: 'timed_search',
            prompt: clue2Defaults.prompt,
            answer: second.code,
            acceptedAnswers: [second.code],
            destinationInstruction:
              `Go to ${second.station.name} now. Find the shared green SECOND SCAN QR. `
              + `All ${Math.max(2, Math.min(8, Number(event.teamSize) || 4))} members scan, then enter your team code to unlock Clue 3.`,
            basePoints: 0,
            maxAttempts: scoring.clue2?.maxAttempts || 3,
            timerSeconds: scoring.clue2?.timerSeconds || 180,
            speedBonusBands: scoring.clue2?.speedBonusBands || [],
            hintText: clue2Defaults.hintText,
            hintCost: scoring.hintCost || 15,
            difficulty: 'medium',
            variantKey,
            active: true,
          },
        },
        { upsert: true },
      );
      clueCount += 1;
    }

    // eslint-disable-next-line no-await-in-loop
    await CampusHuntChallenge.updateMany(
      {
        eventId: event._id,
        routeId: route._id,
        challengeNumber: 2,
        variantKey: 'DEFAULT',
      },
      { $set: { active: false } },
    );

    // Clue 3 variants → shared blue THIRD SCAN QR
    for (const third of thirdStopDefs) {
      if (!wantClue(3)) break;
      const thirdCheckpoint = shared.map.get(`3:${third.station.code}`);
      if (!startingPoint || !thirdCheckpoint) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const variantKey = `${startStation.code}-${third.wave}`;
      const clue3Defaults = routeClueDefaults(3, third.station.name, event.teamSize);
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId: event._id,
          roundId: round._id,
          routeId: route._id,
          challengeNumber: 3,
          variantKey,
        },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint._id,
            thirdCheckpointId: thirdCheckpoint._id,
            challengeNumber: 3,
            type: 'decode',
            prompt: clue3Defaults.prompt,
            answer: clue3Defaults.answer,
            acceptedAnswers: [clue3Defaults.answer].filter(Boolean),
            destinationInstruction: clue3Defaults.destinationInstruction,
            basePoints: scoring.clue3?.basePoints ?? DEFAULT_SCORING_CONFIG.clue3.basePoints ?? 50,
            maxAttempts: scoring.clue3?.maxAttempts || 3,
            timerSeconds: 0,
            hintText: clue3Defaults.hintText,
            hintCost: scoring.hintCost || 15,
            difficulty: 'medium',
            variantKey,
            active: true,
          },
        },
        { upsert: true },
      );
      clueCount += 1;
    }

    // eslint-disable-next-line no-await-in-loop
    await CampusHuntChallenge.updateMany(
      {
        eventId: event._id,
        routeId: route._id,
        challengeNumber: 3,
        variantKey: 'DEFAULT',
      },
      { $set: { active: false } },
    );

    // Clue 4 variants → shared purple FOURTH SCAN (crazy prop hunt)
    for (const fourth of fourthStopDefs) {
      if (!wantClue(4)) break;
      const fourthCheckpoint = shared.map.get(`4:${fourth.station.code}`);
      if (!startingPoint || !fourthCheckpoint) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const variantKey = `${startStation.code}-${fourth.wave}`;
      const clue4Defaults = routeClueDefaults(4, fourth.station.name, event.teamSize);
      const propAnswer = String(fourth.propCode || 'BANANA').toUpperCase();
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntChallenge.findOneAndUpdate(
        {
          eventId: event._id,
          roundId: round._id,
          routeId: route._id,
          challengeNumber: 4,
          variantKey,
        },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint._id,
            fourthCheckpointId: fourthCheckpoint._id,
            challengeNumber: 4,
            type: 'timed_search',
            prompt: clue4Defaults.prompt,
            answer: propAnswer,
            acceptedAnswers: [propAnswer, propAnswer.toLowerCase()],
            destinationInstruction: clue4Defaults.destinationInstruction,
            basePoints: scoring.clue4?.basePoints ?? DEFAULT_SCORING_CONFIG.clue4.basePoints ?? 0,
            maxAttempts: scoring.clue4?.maxAttempts || 3,
            timerSeconds: scoring.clue4?.timerSeconds
              ?? DEFAULT_SCORING_CONFIG.clue4.timerSeconds
              ?? 180,
            speedBonusBands: scoring.clue4?.speedBonusBands
              || DEFAULT_SCORING_CONFIG.clue4.speedBonusBands
              || [],
            hintText: clue4Defaults.hintText,
            hintCost: scoring.hintCost || 15,
            difficulty: 'medium',
            variantKey,
            active: true,
          },
        },
        { upsert: true },
      );
      clueCount += 1;
    }

    // eslint-disable-next-line no-await-in-loop
    await CampusHuntChallenge.updateMany(
      {
        eventId: event._id,
        routeId: route._id,
        challengeNumber: 4,
        variantKey: 'DEFAULT',
      },
      { $set: { active: false } },
    );

    // Finish checkpoint only (Final is Clue 5 below)
    for (const cp of laterDefs) {
      if (!wantClue(5)) break;
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId: event._id, routeId: route._id, checkpointKey: cp.key },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint?._id,
            code: `R${key}-${cp.key}`,
            progressionKey: cp.key,
            checkpointNumber: cp.num,
            checkpointKey: cp.key,
            locationName: cp.station.name,
            stationCode: cp.station.code,
            publicInstruction: cp.instruction,
            sequence: cp.seq,
            capacityGuidance: capacity,
            concurrencyGuidance:
              `Shared campus station — target ~${TARGET_TEAMS_PER_STATION} teams per wave/stage.`,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
          },
        },
        { upsert: true },
      );
      checkpointCount += 1;
    }

    if (wantClue(5)) {
    // eslint-disable-next-line no-await-in-loop
    const clue5Defaults = routeClueDefaults(5, finishWord, event.teamSize);
    clue5Defaults.destinationInstruction =
      `Report to your start — ${startName}. Ask the organizer to mark your team reached.`;
    await CampusHuntChallenge.findOneAndUpdate(
      {
        eventId: event._id,
        roundId: round._id,
        routeId: route._id,
        challengeNumber: 5,
        variantKey: 'DEFAULT',
      },
      {
        $set: {
          eventId: event._id,
          roundId: round._id,
          routeId: route._id,
          startingPointId: startingPoint?._id,
          challengeNumber: 5,
          type: 'collaborative',
          prompt: clue5Defaults.prompt,
          memberPrompts: clue5Defaults.memberPrompts,
          answer: clue5Defaults.answer,
          acceptedAnswers: [clue5Defaults.answer],
          destinationInstruction: clue5Defaults.destinationInstruction,
          basePoints: scoring.clue5?.basePoints
            || scoring.clue4?.basePoints
            || DEFAULT_SCORING_CONFIG.clue5.basePoints
            || 50,
          maxAttempts: scoring.clue5?.maxAttempts
            || scoring.clue4?.maxAttempts
            || 3,
          timerSeconds: scoring.clue5?.timerSeconds
            || DEFAULT_SCORING_CONFIG.clue5.timerSeconds
            || 300,
          speedBonusBands: scoring.clue5?.speedBonusBands
            || DEFAULT_SCORING_CONFIG.clue5.speedBonusBands
            || [],
          hintText: clue5Defaults.hintText,
          hintCost: scoring.hintCost || 15,
          difficulty: 'hard',
          variantKey: 'DEFAULT',
          active: true,
        },
      },
      { upsert: true },
    );
    clueCount += 1;

    // Retire legacy Final that lived on challengeNumber 4 DEFAULT
    await CampusHuntChallenge.updateMany(
      {
        eventId: event._id,
        routeId: route._id,
        challengeNumber: 4,
        type: 'collaborative',
        variantKey: 'DEFAULT',
      },
      { $set: { active: false } },
    );
    }
  }

  // Retire old Clue 1 rows that still use wait names (Library/Chanakya/…) as scan places
  const waitNames = WAIT_POINTS.map((w) => new RegExp(`^${w.name}$`, 'i'));
  const retired = await CampusHuntCheckpoint.updateMany(
    {
      eventId: event._id,
      roundId: round._id,
      progressionKey: '1',
      $or: waitNames.map((name) => ({ locationName: name })),
    },
    {
      $set: {
        active: false,
        concurrencyGuidance: 'Retired — starting points are not hunt stations. Use the 10 campus stations.',
      },
    },
  );

  return {
    checkpointCount,
    clueCount,
    retiredWaitNamedCheckpoints: retired.modifiedCount || 0,
    retiredTeamBoundCheckpoints: shared.retired || 0,
  };
}

async function ensurePlaceholderTeams(event, round, routes, {
  createTeams = true,
  leaderPassword = 'HUNT2026',
  scannerPassword = 'HUNT2026',
} = {}) {
  if (!createTeams) {
    return { created: 0, skipped: 0, teams: [] };
  }

  const capacity = Number(event.teamCapacity) || 40;
  const existing = await CampusHuntTeam.find({ eventId: event._id }).select('teamCode');
  const existingCodes = new Set(existing.map((t) => String(t.teamCode || '').toUpperCase()));
  const created = [];
  let skipped = 0;

  for (let i = 1; i <= capacity; i += 1) {
    const teamCode = padTeam(i);
    if (existingCodes.has(teamCode)) {
      skipped += 1;
      // eslint-disable-next-line no-continue
      continue;
    }
    const route = routes[(i - 1) % routes.length];
    // eslint-disable-next-line no-await-in-loop
    const eventCount = await CampusHuntTeam.countDocuments({ eventId: event._id });
    assertCapacityCounts({
      eventCount,
      eventCapacity: event.teamCapacity,
      pendingCount: 1,
    });
    // eslint-disable-next-line no-await-in-loop
    const provisioned = await provisionTeamRoster({
      eventId: event._id,
      teamCode,
      teamName: `Team ${i}`,
      leaderEmail: `team${i}.leader@campus-hunt.local`,
      leaderName: `Leader ${i}`,
      leaderPassword,
      memberNames: Array.from({ length: Math.max(1, (Number(event.teamSize) || 4) - 1) }, (_, idx) => (
        `Member ${i}${String.fromCharCode(65 + idx)}`
      )),
      scannerPassword,
      teamSize: event.teamSize || 4,
    });
    const roster = assertValidTeamRoster({
      leaderUserId: provisioned.leaderUserId,
      memberUserIds: provisioned.memberUserIds,
      teamSize: event.teamSize || 4,
    });
    // eslint-disable-next-line no-await-in-loop
    const team = await CampusHuntTeam.create({
      eventId: event._id,
      roundId: round._id,
      routeId: route?._id,
      teamCode,
      teamName: `Team ${i}`,
      ...roster,
      leaderName: provisioned.leaderName,
      leaderContactEmail: provisioned.leaderContactEmail,
      memberNames: provisioned.memberNames,
      accessPack: provisioned.accessPack,
      startingScore: event.startingScore,
      currentScore: event.startingScore,
      status: 'registered',
      currentStage: 'WAITING',
      startStatus: 'WAITING',
    });
    created.push({ id: String(team._id), teamCode, teamName: team.teamName });
  }

  const rosterRepair = await repairAllTeamRostersForEvent(event._id, {
    leaderPassword,
    scannerPassword,
  });

  return {
    created: created.length,
    skipped,
    teams: created,
    rosterRepair,
  };
}

/**
 * @param {object} options
 * @param {string} options.eventId
 * @param {object} [options.actor]
 * @param {boolean} [options.createTeams]
 * @param {boolean} [options.enablePublicLeaderboard]
 * @param {number[]|null} [options.challengeNumbers] null = all clues; [] = layout only; [1] = Clue 1 only
 */
async function bootstrapRound1Defaults({
  eventId,
  actor = {},
  createTeams = true,
  enablePublicLeaderboard = true,
  challengeNumbers = null,
} = {}) {
  if (typeof CampusHuntChallenge.ensureChallengeIndexes === 'function') {
    await CampusHuntChallenge.ensureChallengeIndexes();
  }

  const event = await CampusHuntEvent.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }

  if (!event.teamCapacity || event.teamCapacity < 2) {
    event.teamCapacity = 40;
  }
  if (!event.scoringConfig) {
    event.scoringConfig = { ...DEFAULT_SCORING_CONFIG };
  } else {
    // Keep Round 1 scoring: 50/clue, hint −15, late = 0 but still advance.
    event.scoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      ...(event.scoringConfig.toObject?.() || event.scoringConfig),
      startingScore: DEFAULT_SCORING_CONFIG.startingScore,
      hintCost: DEFAULT_SCORING_CONFIG.hintCost,
      clue1: { ...DEFAULT_SCORING_CONFIG.clue1 },
      clue2: {
        ...DEFAULT_SCORING_CONFIG.clue2,
      },
      clue3: { ...DEFAULT_SCORING_CONFIG.clue3 },
      clue4: { ...DEFAULT_SCORING_CONFIG.clue4 },
      clue5: { ...DEFAULT_SCORING_CONFIG.clue5 },
    };
    event.markModified('scoringConfig');
  }
  if (enablePublicLeaderboard) {
    event.publicLeaderboardLive = true;
  }
  const huntStations = resolveCampusStations(event);
  if (!event.campusStations?.length) {
    event.campusStations = DEFAULT_CAMPUS_STATIONS;
  }
  await event.save();

  const round = await ensureRound(event);
  const capacity = Number(event.teamCapacity) || 40;
  const startCount = resolveStartCount(event);
  const perWait = teamsPerWaitFor(capacity, startCount);
  const perStation = teamsPerStationFor(capacity, huntStations.length);
  const teamGroups = buildTeamGroups(perWait);
  const startingPoints = await ensureLocations(event, round, perWait, startCount);
  const routes = await ensureRoutes(event, capacity, startCount);
  const content = await ensureCheckpointsAndClues(
    event,
    round,
    routes,
    startingPoints,
    perStation,
    huntStations,
    teamGroups,
    perWait,
    challengeNumbers,
  );

  const layoutOnly = Array.isArray(challengeNumbers) && challengeNumbers.length === 0;
  let clue4Reconciled = { updated: 0, skipped: 0 };
  let teamBindingsResynced = null;
  if (layoutOnly) {
    clue4Reconciled = await reconcileClue4ToActiveLayout(
      event,
      round,
      routes,
      startingPoints,
      huntStations,
      teamGroups,
    );
    const { resyncClue1TeamBindings } = require('./startScheduleService');
    teamBindingsResynced = await resyncClue1TeamBindings({
      eventId: event._id,
      roundId: round._id,
      actor,
      reason: 'layout_save_clue4_reconcile',
    });
  }

  const updatingAllClues = challengeNumbers == null;
  const updatingClue1 = updatingAllClues
    || (Array.isArray(challengeNumbers) && challengeNumbers.map(Number).includes(1));
  const updatingClue3 = updatingAllClues
    || (Array.isArray(challengeNumbers) && challengeNumbers.map(Number).includes(3));

  // Patch legacy Clue 1 rows that stored basePoints: 0 (flat award was never applied).
  if (updatingClue1) {
  await CampusHuntChallenge.updateMany(
    {
      eventId: event._id,
      challengeNumber: 1,
      active: true,
      $or: [{ basePoints: 0 }, { basePoints: { $exists: false } }],
    },
    {
      $set: {
        basePoints: DEFAULT_SCORING_CONFIG.clue1.basePoints ?? 50,
      },
    },
  );
  }
  // Patch Clue 3 rows still on legacy 75 when config is 50.
  if (updatingClue3) {
  await CampusHuntChallenge.updateMany(
    {
      eventId: event._id,
      challengeNumber: 3,
      active: true,
      basePoints: 75,
    },
    {
      $set: {
        basePoints: DEFAULT_SCORING_CONFIG.clue3.basePoints ?? 50,
      },
    },
  );
  }
  const teams = await ensurePlaceholderTeams(event, round, routes, { createTeams });

  await writeAudit({
    eventId: event._id,
    ...actor,
    action: 'round1_bootstrap',
    targetType: 'event',
    targetId: event._id,
    after: {
      locations: startingPoints.map((p) => p.code),
      routes: routes.map((r) => r.routeKey),
      checkpoints: content.checkpointCount,
      clues: content.clueCount,
      challengeNumbers: challengeNumbers == null ? 'all' : challengeNumbers,
      clue4Reconciled,
      teamBindingsResynced: teamBindingsResynced
        ? { updated: teamBindingsResynced.updated, incomplete: teamBindingsResynced.incomplete }
        : null,
      teamsCreated: teams.created,
      publicLeaderboardLive: event.publicLeaderboardLive,
      releaseIntervalMinutes: 5,
    },
  });

  return {
    event,
    round,
    startingPoints: startingPoints.map((p) => ({
      id: String(p._id),
      code: p.code,
      name: p.name,
      capacity: p.capacity,
    })),
    routes: routes.map((r) => ({
      id: String(r._id),
      routeKey: r.routeKey,
      teamSlots: r.teamSlots,
    })),
    checkpointsCreated: content.checkpointCount,
    cluesCreated: content.clueCount,
    clue4Reconciled,
    teamBindingsResynced,
    teams,
    scheduleHint: {
      releaseIntervalMinutes: 5,
      model:
        '4 starting points (gather only). 10 campus stations with 1 shared QR each (per scan stage). '
        + 'First stops shuffled by starting point so simultaneous releases avoid crowds; '
        + `~${Math.ceil((Number(event.teamCapacity) || 40) / Math.max(1, Number(event.stationCount) || 10))} teams/station across the event. `
        + `All ${Math.max(2, Math.min(8, Number(event.teamSize) || 4))} members scan, then enter team code. `
        + 'Team 1 @ first release, Team 2 +5 min, …',
    },
  };
}

async function reconcileClue4ToActiveLayout(
  event,
  round,
  routes,
  startingPoints,
  huntStations,
  teamGroups,
) {
  if (!routes?.length || !huntStations?.length || !teamGroups?.length) {
    return { updated: 0, skipped: 0 };
  }

  const capacity = Number(event.teamCapacity) || 40;
  const perStation = teamsPerStationFor(capacity, huntStations.length);
  const shared = await ensureSharedStationCheckpoints(
    event,
    round,
    routes[0],
    huntStations,
    perStation,
  );

  const pointsByCode = new Map(
    startingPoints.map((point) => [String(point.code || '').toUpperCase(), point]),
  );
  const activeCodes = new Set(huntStations.map((s) => String(s.code).toUpperCase()));
  const starts = resolveCampusStarts(event);

  let updated = 0;
  let skipped = 0;

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex];
    const key = route.routeKey;
    const startIndex = ROUTE_KEYS.indexOf(key);
    const stationIndex = startIndex >= 0 ? startIndex : routeIndex;
    const startStation = starts[stationIndex] || WAIT_POINTS[stationIndex] || WAIT_POINTS[0];
    const startingPoint = pointsByCode.get(startStation.code) || startingPoints[stationIndex];
    if (!startingPoint) {
      skipped += teamGroups.length;
      // eslint-disable-next-line no-continue
      continue;
    }

    const fourthStops = rotatingFourthStops(stationIndex, huntStations, teamGroups);

    for (const group of teamGroups) {
      const fourthStation = fourthStops[group.slot];
      if (!fourthStation || !activeCodes.has(String(fourthStation.code).toUpperCase())) {
        skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      const fourthCheckpoint = shared.map.get(`4:${fourthStation.code}`);
      if (!fourthCheckpoint) {
        skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }

      const variantKey = `${startStation.code}-${group.wave}`;
      const propAnswer = propCodeForTeam(stationIndex, group.localTeamNumber);

      // eslint-disable-next-line no-await-in-loop
      const result = await CampusHuntChallenge.updateOne(
        {
          eventId: event._id,
          routeId: route._id,
          challengeNumber: 4,
          variantKey,
          active: { $ne: false },
        },
        {
          $set: {
            fourthCheckpointId: fourthCheckpoint._id,
            answer: propAnswer,
            acceptedAnswers: [propAnswer, propAnswer.toLowerCase()],
          },
        },
      );
      if (result.matchedCount) updated += 1;
    }
  }

  return { updated, skipped };
}

async function syncSharedStationQrs(event, round, routes) {
  if (!event || !round || !Array.isArray(routes) || !routes.length) {
    return { created: 0, retired: 0 };
  }
  const huntStations = resolveCampusStations(event);
  if (!huntStations.length) return { created: 0, retired: 0 };
  const capacity = Number(event.teamCapacity) || 40;
  const perStation = teamsPerStationFor(capacity, huntStations.length);
  return ensureSharedStationCheckpoints(event, round, routes[0], huntStations, perStation);
}

module.exports = {
  bootstrapRound1Defaults,
  syncSharedStationQrs,
  reconcileClue4ToActiveLayout,
  buildTeamGroups,
  teamsPerWaitFor,
  DEFAULT_LOCATIONS,
  CAMPUS_STATIONS,
  WAIT_POINTS,
  HUNT_STATIONS,
  ROUTE_KEYS,
  TEAM_GROUPS,
  TARGET_TEAMS_PER_STATION,
  rotatingFirstStops,
  rotatingSecondStops,
  rotatingThirdStops,
  rotatingFourthStops,
  propCodeForTeam,
  caesarShift,
  threeDigitCodeForTeam,
  stationForLocalTeam,
  routeClueDefaults,
  CLUE5_WORDS,
};
