/**
 * Round 1 defaults: 40 teams across 4 starting points (×10),
 * parallel 5-min releases, 4 clues → 10 campus checkpoint stations.
 *
 * Starting points (Library / Chanakya / Design / Vyas) are HOLD points only.
 * Hunt scans use a separate list of ~10 campus stations.
 * Clue 1: first stops are shuffled by starting point so simultaneous releases
 * do not pile into one place (Library T1 → Food Court, Chanakya T1 →
 * Amphitheatre, …). Each station still gets 4 teams total across waves.
 */

const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const { DEFAULT_SCORING_CONFIG } = require('../constants');
const { provisionTeamRoster } = require('./rosterProvisionService');
const { assertValidTeamRoster } = require('../utils/roster');
const { assertCapacityCounts } = require('./capacityService');
const { writeAudit } = require('./auditService');
const {
  DEFAULT_CAMPUS_STATIONS,
  resolveCampusStations,
} = require('./stationCatalogService');

const ROUTE_KEYS = ['A', 'B', 'C', 'D'];
const TARGET_TEAMS_PER_STATION = 4;
const TEAMS_PER_WAIT = 10;

/** 4 starting points only — teams hold here until release. */
const WAIT_POINTS = [
  { code: 'A', name: 'Library', description: 'Starting point — 10 teams hold here until release.' },
  { code: 'B', name: 'Chanakya Porch', description: 'Starting point — 10 teams hold here until release.' },
  { code: 'C', name: 'Design', description: 'Starting point — 10 teams hold here until release.' },
  { code: 'D', name: 'Vyas Parking', description: 'Starting point — 10 teams hold here until release.' },
];

/** Default hunt stations — prefer event.campusStations via resolveCampusStations. */
const HUNT_STATIONS = DEFAULT_CAMPUS_STATIONS;
const CAMPUS_STATIONS = HUNT_STATIONS;
const DEFAULT_LOCATIONS = WAIT_POINTS;

/** Local Team 1–10 release slots (variant keys T1…T10). */
const TEAM_GROUPS = Array.from({ length: TEAMS_PER_WAIT }, (_, i) => ({
  wave: `T${i + 1}`,
  teamLabel: `team ${i + 1}`,
  slot: i,
  localTeamNumber: i + 1,
}));

function stationForLocalTeam(localTeamNumber, waitIndex = 0, stations = HUNT_STATIONS, stopOffset = 0) {
  const list = stations?.length ? stations : HUNT_STATIONS;
  const teamIndex = (Math.max(1, Number(localTeamNumber) || 1) - 1) % list.length;
  const offset = Math.max(0, Number(waitIndex) || 0) % list.length;
  const step = Math.max(0, Number(stopOffset) || 0) % list.length;
  return list[(teamIndex + offset + step) % list.length];
}

/** Stable unique 3-digit code for global team 1–40. */
function threeDigitCodeForTeam(waitIndex, localTeamNumber) {
  const teamNumber = (Math.max(0, Number(waitIndex) || 0) * TEAMS_PER_WAIT)
    + Math.max(1, Number(localTeamNumber) || 1);
  return String(100 + ((teamNumber * 73 + 19) % 900)).padStart(3, '0');
}

function clue1ForPlace(place) {
  const name = place || 'the station';
  return {
    prompt:
      `Your first scan is waiting on campus. Read the marks, follow the crowd of clues, `
      + `and name the place: ${name}.`,
    answer: name,
    destinationInstruction: `Go to ${name}. All four members scan there.`,
    hintText: `Ask staff for the way to ${name}.`,
  };
}

function routeClueDefaults(challengeNumber, destination) {
  const place = destination || 'the next station';
  const n = Number(challengeNumber) || 2;

  if (n === 2) {
    return {
      prompt:
        'A staff mark hides in plain sight nearby. '
        + 'Scan the area at eye level — find your team’s 3-digit number.',
      answer: '',
      hintText: 'Check posts, pillars, and notice boards at eye level.',
      destinationInstruction:
        'Go to your next location now. Find your team’s green SECOND SCAN QR — '
        + 'all 4 members scan to unlock Clue 3.',
      memberPrompts: ['', '', '', ''],
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
        'Riddle solved — go find your blue Checkpoint 3 card at that place. '
        + 'All 4 members scan to unlock Final.',
      memberPrompts: ['', '', '', ''],
    };
  }

  // Clue 4 / Final — collaborative one-word puzzle; `place` here is the finish word.
  const word = String(place || 'QUEST').replace(/\s+/g, '').toUpperCase();
  const chunks = splitIntoFourCodes(word);
  return {
    prompt:
      'Each teammate has a code fragment on their phone. '
      + 'Speak them in order 1→4 and rebuild the one word. Leader submits it.',
    answer: word,
    hintText: 'Say every code out loud in member order — no spaces in the final word.',
    destinationInstruction:
      'Word solved — report to your start location. Ask the organizer to mark your team reached.',
    memberPrompts: chunks,
  };
}

function splitIntoFourCodes(word) {
  const raw = String(word || 'QUEST').replace(/\s+/g, '').toUpperCase();
  const len = Math.max(4, raw.length);
  const padded = raw.padEnd(len, 'X');
  const size = Math.ceil(padded.length / 4);
  return [0, 1, 2, 3].map((i) => padded.slice(i * size, (i + 1) * size) || String(i + 1));
}

/** One-word answers per start path for Clue 4. */
const CLUE4_WORDS = {
  A: 'QUEST',
  B: 'BLAZE',
  C: 'SPARK',
  D: 'PRIDE',
};

/** Clue 1 first stops for local teams 1–10 at a given wait (shuffled by waitIndex). */
function rotatingFirstStops(waitIndex = 0, stations = HUNT_STATIONS) {
  return TEAM_GROUPS.map((group) => stationForLocalTeam(group.localTeamNumber, waitIndex, stations, 0));
}

/** Checkpoint 2 / Clue 2 destinations — one station after first stop. */
function rotatingSecondStops(waitIndex = 0, stations = HUNT_STATIONS) {
  return TEAM_GROUPS.map((group) => stationForLocalTeam(group.localTeamNumber, waitIndex, stations, 1));
}

/** Checkpoint 3 destinations — two stations after first stop (different from CP1/CP2). */
function rotatingThirdStops(waitIndex = 0, stations = HUNT_STATIONS) {
  return TEAM_GROUPS.map((group) => stationForLocalTeam(group.localTeamNumber, waitIndex, stations, 2));
}

function caesarShift(text, shift = 3) {
  return String(text || '').replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
  });
}

/** @deprecated */
function alternatingFirstPair(waitIndex = 0, stations = HUNT_STATIONS) {
  const stops = rotatingFirstStops(waitIndex, stations);
  return [stops[0], stops[1]];
}

/** Clues 2–4 path for a wait (offset across the 10 stations). */
function visitOrderForStart(startIndex, stations = HUNT_STATIONS) {
  const list = stations?.length ? stations : HUNT_STATIONS;
  const base = (Number(startIndex) || 0) * 2;
  return [0, 1, 2, 3].map((offset) => (
    list[(base + offset + 1) % list.length]
  ));
}

function padTeam(n) {
  return `CC${String(n).padStart(3, '0')}`;
}

async function ensureRound(event) {
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
      qualification: {
        topNDirectFinale: 8,
        survivalTeams: 32,
        lastChanceTeams: 12,
        finaleTeams: 5,
        nextRoundName: 'SURVIVAL_STAGE',
      },
    });
  } else {
    if (!round.releaseIntervalMinutes || round.releaseIntervalMinutes < 1) {
      round.releaseIntervalMinutes = 5;
    }
    if (!round.assignmentStrategy) round.assignmentStrategy = 'route_balanced';
    round.qualification = {
      ...(round.qualification?.toObject?.() || round.qualification || {}),
      topNDirectFinale: 8,
      survivalTeams: 32,
      lastChanceTeams: 12,
      finaleTeams: 5,
      nextRoundName: 'SURVIVAL_STAGE',
    };
    await round.save();
  }
  return round;
}

async function ensureLocations(event, round, capacity = 10) {
  const points = [];
  const canonicalCodes = DEFAULT_LOCATIONS.map((loc) => loc.code);
  for (let index = 0; index < DEFAULT_LOCATIONS.length; index += 1) {
    const loc = DEFAULT_LOCATIONS[index];
    // eslint-disable-next-line no-await-in-loop
    const point = await CampusHuntStartingPoint.findOneAndUpdate(
      { eventId: event._id, code: loc.code },
      {
        $set: {
          eventId: event._id,
          roundId: round._id,
          code: loc.code,
          name: loc.name,
          description: loc.description,
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
  // Retire legacy duplicates (START-A / START A) so schedule capacity stays 4×10=40.
  await CampusHuntStartingPoint.updateMany(
    {
      eventId: event._id,
      code: { $nin: canonicalCodes },
    },
    { $set: { active: false } },
  );
  return points;
}

async function ensureRoutes(event, teamCapacity = 40) {
  const routes = [];
  const slots = Math.ceil(teamCapacity / ROUTE_KEYS.length);
  for (const key of ROUTE_KEYS) {
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
  return routes;
}

async function ensureCheckpointsAndClues(
  event,
  round,
  routes,
  startingPoints,
  capacity = TARGET_TEAMS_PER_STATION,
  huntStations = HUNT_STATIONS,
) {
  const scoring = event.scoringConfig || DEFAULT_SCORING_CONFIG;
  const stations = huntStations?.length ? huntStations : HUNT_STATIONS;
  let checkpointCount = 0;
  let clueCount = 0;
  const pointsByCode = new Map(
    startingPoints.map((point) => [String(point.code || '').toUpperCase(), point]),
  );

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex];
    const key = route.routeKey;
    const startIndex = ROUTE_KEYS.indexOf(key);
    const stationIndex = startIndex >= 0 ? startIndex : routeIndex;
    const startStation = WAIT_POINTS[stationIndex] || WAIT_POINTS[0];
    const startingPoint = pointsByCode.get(startStation.code) || startingPoints[stationIndex];
    const firstStops = rotatingFirstStops(stationIndex, stations);
    const secondStops = rotatingSecondStops(stationIndex, stations);
    const thirdStops = rotatingThirdStops(stationIndex, stations);
    const finishWord = CLUE4_WORDS[key] || 'QUEST';
    const startName = startStation.name;

    const firstStopDefs = TEAM_GROUPS.map((group) => ({
      wave: group.wave,
      teamLabel: group.teamLabel,
      localTeamNumber: group.localTeamNumber,
      station: firstStops[group.slot],
      key: `1-${group.wave}`,
    }));

    const secondStopDefs = TEAM_GROUPS.map((group) => ({
      wave: group.wave,
      teamLabel: group.teamLabel,
      localTeamNumber: group.localTeamNumber,
      station: secondStops[group.slot],
      key: `2-${group.wave}`,
      code: threeDigitCodeForTeam(stationIndex, group.localTeamNumber),
    }));

    const thirdStopDefs = TEAM_GROUPS.map((group) => ({
      wave: group.wave,
      teamLabel: group.teamLabel,
      localTeamNumber: group.localTeamNumber,
      station: thirdStops[group.slot],
      key: `3-${group.wave}`,
    }));

    const laterDefs = [
      {
        key: 'FINISH',
        num: 4,
        seq: 4,
        station: startStation,
        instruction:
          `Finish at ${startName} (your start). `
          + 'Ask the organizer to mark your team reached — score locks when marked.',
      },
    ];

    for (const first of firstStopDefs) {
      // eslint-disable-next-line no-await-in-loop
      const firstCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId: event._id, routeId: route._id, checkpointKey: first.key },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint?._id,
            code: `R${key}-${first.key}`,
            progressionKey: '1',
            checkpointNumber: 1,
            checkpointKey: first.key,
            locationName: first.station.name,
            stationCode: first.station.code,
            publicInstruction:
              `FIRST SCAN at ${first.station.name} (${first.teamLabel}). `
              + 'This card is for your team only — other QRs at this spot will not work. '
              + 'All 4 members scan to unlock Clue 2. '
              + 'Then pick up your card and take it so the next teams only find theirs.',
            sequence: 1,
            capacityGuidance: capacity,
            concurrencyGuidance:
              `Target ${TARGET_TEAMS_PER_STATION} teams per campus station across the event. `
              + 'First stops are shuffled by starting point so parallel releases do not pile up. '
              + 'Starting points (Library/Chanakya/Design/Vyas) are gather spots only.',
            active: true,
            compensationPolicyKey: 'skip_and_continue',
          },
        },
        { upsert: true, new: true },
      );
      checkpointCount += 1;

      if (startingPoint && firstCheckpoint) {
        const variantKey = `${startStation.code}-${first.wave}`;
        const clue1 = clue1ForPlace(first.station.name);
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
              destinationInstruction: clue1.destinationInstruction,
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
    }

    // Checkpoint 2 + Clue 2 variants (10 waves × team-bound SECOND SCAN)
    for (const second of secondStopDefs) {
      // eslint-disable-next-line no-await-in-loop
      const secondCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId: event._id, routeId: route._id, checkpointKey: second.key },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint?._id,
            code: `R${key}-${second.key}`,
            progressionKey: '2',
            checkpointNumber: 2,
            checkpointKey: second.key,
            locationName: second.station.name,
            stationCode: second.station.code,
            publicInstruction:
              `SECOND SCAN at ${second.station.name} (${second.teamLabel}). `
              + 'Scan only after Clue 2. This card is for your team only. '
              + 'All 4 members scan to unlock Clue 3. '
              + 'Pick up this green card when you leave.',
            sequence: 2,
            capacityGuidance: capacity,
            concurrencyGuidance:
              `Target ${TARGET_TEAMS_PER_STATION} teams per campus station for Checkpoint 2. `
              + 'SECOND SCAN posters sit at the next place after each team’s first stop.',
            active: true,
            compensationPolicyKey: 'skip_and_continue',
          },
        },
        { upsert: true, new: true },
      );
      checkpointCount += 1;

      if (startingPoint && secondCheckpoint) {
        const variantKey = `${startStation.code}-${second.wave}`;
        const clue2Defaults = routeClueDefaults(2, second.station.name);
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
                `Go to ${second.station.name} now. Find your team’s green SECOND SCAN QR. `
                + 'All 4 members scan to unlock Clue 3.',
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
    }

    // Hide legacy shared CP2 (pre–fan-out) so teams only see team posters.
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntCheckpoint.updateMany(
      { eventId: event._id, routeId: route._id, checkpointKey: '2', progressionKey: '2' },
      { $set: { active: false } },
    );
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

    // Checkpoint 3 + Clue 3 variants (10 waves × team-bound blue THIRD SCAN)
    for (const third of thirdStopDefs) {
      // eslint-disable-next-line no-await-in-loop
      const thirdCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId: event._id, routeId: route._id, checkpointKey: third.key },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint?._id,
            code: `R${key}-${third.key}`,
            progressionKey: '3',
            checkpointNumber: 3,
            checkpointKey: third.key,
            locationName: third.station.name,
            stationCode: third.station.code,
            publicInstruction:
              `THIRD SCAN (blue) at ${third.station.name} (${third.teamLabel}). `
              + 'Scan only after the Clue 3 riddle. This card is for your team only. '
              + 'All 4 members scan to unlock the Final clue. '
              + 'Then pick up your blue card and take it.',
            sequence: 3,
            capacityGuidance: capacity,
            concurrencyGuidance:
              `Target ${TARGET_TEAMS_PER_STATION} teams per campus station for Checkpoint 3. `
              + 'Blue cards sit two stops after each team’s first stop.',
            active: true,
            compensationPolicyKey: 'skip_and_continue',
          },
        },
        { upsert: true, new: true },
      );
      checkpointCount += 1;

      if (startingPoint && thirdCheckpoint) {
        const variantKey = `${startStation.code}-${third.wave}`;
        const clue3Defaults = routeClueDefaults(3, third.station.name);
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
    }

    // Hide legacy shared CP3 / DEFAULT clue3
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntCheckpoint.updateMany(
      { eventId: event._id, routeId: route._id, checkpointKey: '3', progressionKey: '3' },
      { $set: { active: false } },
    );
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

    // Finish checkpoint only (Clue 3 is fan-out variants above)
    for (const cp of laterDefs) {
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

    // eslint-disable-next-line no-await-in-loop
    const clue4Defaults = routeClueDefaults(4, finishWord);
    clue4Defaults.destinationInstruction =
      `Report to your start — ${startName}. Ask the organizer to mark your team reached.`;
    await CampusHuntChallenge.findOneAndUpdate(
      {
        eventId: event._id,
        roundId: round._id,
        routeId: route._id,
        challengeNumber: 4,
        variantKey: 'DEFAULT',
      },
      {
        $set: {
          eventId: event._id,
          roundId: round._id,
          routeId: route._id,
          startingPointId: startingPoint?._id,
          challengeNumber: 4,
          type: 'collaborative',
          prompt: clue4Defaults.prompt,
          memberPrompts: clue4Defaults.memberPrompts,
          answer: clue4Defaults.answer,
          acceptedAnswers: [clue4Defaults.answer],
          destinationInstruction: clue4Defaults.destinationInstruction,
          basePoints: scoring.clue4?.basePoints || 50,
          maxAttempts: scoring.clue4?.maxAttempts || 3,
          timerSeconds: scoring.clue4?.timerSeconds || 300,
          speedBonusBands: scoring.clue4?.speedBonusBands || [],
          hintText: clue4Defaults.hintText,
          hintCost: scoring.hintCost || 15,
          difficulty: 'hard',
          variantKey: 'DEFAULT',
          active: true,
        },
      },
      { upsert: true },
    );
    clueCount += 1;
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
      memberNames: [`Member ${i}A`, `Member ${i}B`, `Member ${i}C`],
      scannerPassword,
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

  return { created: created.length, skipped, teams: created };
}

/**
 * @param {object} options
 * @param {string} options.eventId
 * @param {object} [options.actor]
 * @param {boolean} [options.createTeams]
 * @param {boolean} [options.enablePublicLeaderboard]
 */
async function bootstrapRound1Defaults({
  eventId,
  actor = {},
  createTeams = true,
  enablePublicLeaderboard = true,
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

  if (!event.teamCapacity || event.teamCapacity < 40) {
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
    };
    event.markModified('scoringConfig');
  }
  if (enablePublicLeaderboard) {
    event.publicLeaderboardLive = true;
  }
  const huntStations = resolveCampusStations(event);
  if (!event.campusStations?.length) {
    event.campusStations = huntStations;
  }
  await event.save();

  const round = await ensureRound(event);
  const startingPoints = await ensureLocations(event, round, 10);
  const routes = await ensureRoutes(event, event.teamCapacity || 40);
  const content = await ensureCheckpointsAndClues(
    event,
    round,
    routes,
    startingPoints,
    TARGET_TEAMS_PER_STATION,
    huntStations,
  );

  // Patch legacy Clue 1 rows that stored basePoints: 0 (flat award was never applied).
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
  // Patch Clue 3 rows still on legacy 75 when config is 50.
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
    teams,
    scheduleHint: {
      releaseIntervalMinutes: 5,
      model:
        '4 starting points (gather only). 10 campus checkpoints. '
        + 'First stops shuffled by starting point (Library→Food Court, Chanakya→Amphitheatre, …) '
        + 'so simultaneous releases avoid crowds; 4 teams/station across the event. '
        + 'Team 1 @ first release, Team 2 +5 min, … Team 10.',
    },
  };
}

module.exports = {
  bootstrapRound1Defaults,
  DEFAULT_LOCATIONS,
  CAMPUS_STATIONS,
  WAIT_POINTS,
  HUNT_STATIONS,
  ROUTE_KEYS,
  TEAM_GROUPS,
  TARGET_TEAMS_PER_STATION,
  visitOrderForStart,
  rotatingFirstStops,
  rotatingSecondStops,
  rotatingThirdStops,
  caesarShift,
  threeDigitCodeForTeam,
  alternatingFirstPair,
  stationForLocalTeam,
};
