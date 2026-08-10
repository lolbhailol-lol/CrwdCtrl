/**
 * Seed a pilot Campus Hunt event: 4 routes, challenges, checkpoints, volunteers.
 *
 * Usage (from backend/):
 *   CAMPUS_HUNT_ENABLED=true node scripts/seed-campus-hunt-pilot.js
 *
 * Optional env:
 *   CAMPUS_HUNT_SEED_RESET=true node scripts/seed-campus-hunt-pilot.js --reset
 *     — delete existing pilot slug first (both flag and env are required)
 *   CAMPUS_HUNT_VOLUNTEER_PASSWORD=hunt2026
 *   CAMPUS_HUNT_START_COUNT=4
 *   CAMPUS_HUNT_START_CAPACITY=10
 *   CAMPUS_HUNT_RELEASE_INTERVAL_MINUTES=2
 *   CAMPUS_HUNT_STARTS_AT=2026-08-09T09:00:00+05:30
 *   CAMPUS_HUNT_STARTING_LOCATIONS='[{"code":"NORTH","name":"North Gate"}]'
 *   CAMPUS_HUNT_CLUE1_VARIANTS='[{"startingPointCode":"NORTH","routeKey":"A",...}]'
 *
 * Equivalent CLI flags: --start-count, --start-capacity, --release-interval,
 * --starts-at, and --team-capacity.
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');

registerModels();

const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
const CampusHuntRoute = require('../src/modules/campus-hunt/models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../src/modules/campus-hunt/models/CampusHuntStartingPoint');
const CampusHuntChallenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const CampusHuntVolunteerAccess = require('../src/modules/campus-hunt/models/CampusHuntVolunteerAccess');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const CampusHuntTeamProgress = require('../src/modules/campus-hunt/models/CampusHuntTeamProgress');
const CampusHuntCheckpointVerification = require('../src/modules/campus-hunt/models/CampusHuntCheckpointVerification');
const CampusHuntIssueReport = require('../src/modules/campus-hunt/models/CampusHuntIssueReport');
const CampusHuntAuditLog = require('../src/modules/campus-hunt/models/CampusHuntAuditLog');
const User = require('../src/model/usermodel');
const { DEFAULT_SCORING_CONFIG } = require('../src/modules/campus-hunt/constants');
const {
  buildDeterministicSchedule,
} = require('../src/modules/campus-hunt/services/startScheduleService');

const SLUG = process.env.CAMPUS_HUNT_SLUG || 'pilot-campus-hunt';
const ROUTE_KEYS = ['A', 'B', 'C', 'D'];

function argumentValue(argv, name) {
  const equals = argv.find((value) => value.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function positiveInteger(value, label, fallback) {
  const resolved = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return resolved;
}

function parseJsonArray(value, label) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array`);
  return parsed;
}

function readSeedConfig(env = process.env, argv = process.argv.slice(2)) {
  const startCount = positiveInteger(
    argumentValue(argv, '--start-count') || env.CAMPUS_HUNT_START_COUNT,
    'start count',
    4,
  );
  const startCapacity = positiveInteger(
    argumentValue(argv, '--start-capacity') || env.CAMPUS_HUNT_START_CAPACITY,
    'start capacity',
    10,
  );
  const releaseIntervalMinutes = positiveInteger(
    argumentValue(argv, '--release-interval')
      || env.CAMPUS_HUNT_RELEASE_INTERVAL_MINUTES,
    'release interval',
    5,
  );
  const teamCapacity = positiveInteger(
    argumentValue(argv, '--team-capacity') || env.CAMPUS_HUNT_TEAM_CAPACITY,
    'team capacity',
    startCount * startCapacity,
  );
  if (teamCapacity > startCount * startCapacity) {
    throw new Error(
      `team capacity ${teamCapacity} exceeds starting capacity ${startCount * startCapacity}`,
    );
  }
  const startsAtRaw = argumentValue(argv, '--starts-at')
    || env.CAMPUS_HUNT_STARTS_AT
    || new Date().toISOString();
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) throw new Error('starts-at must be a valid date');

  const configuredLocations = parseJsonArray(
    env.CAMPUS_HUNT_STARTING_LOCATIONS,
    'CAMPUS_HUNT_STARTING_LOCATIONS',
  );
  const locations = configuredLocations.length
    ? configuredLocations
    : Array.from({ length: startCount }, (_, index) => {
      const code = String.fromCharCode(65 + index); // A, B, C, D
      const names = [
        'Library',
        'Chanakya Porch',
        'Design',
        'Vyas Parking',
      ];
      // Shuffled first hunt stops (not waits) so parallel releases avoid crowds.
      const firstStops = [
        'Food Court',
        'Amphitheatre',
        'Main Gate',
        'Sports Complex',
      ];
      return {
        code,
        name: names[index] || `Location ${code}`,
        description:
          `10 teams wait at ${names[index]}. `
          + `Wave 1 leaves toward ${firstStops[index]} (shuffled by wait); then +5 min.`,
      };
    });
  if (locations.length !== startCount) {
    throw new Error(`Expected ${startCount} starting locations, received ${locations.length}`);
  }
  const normalizedCodes = locations.map((location) => String(location.code || '').trim().toUpperCase());
  if (
    normalizedCodes.some((code) => !code)
    || new Set(normalizedCodes).size !== normalizedCodes.length
    || locations.some((location) => !String(location.name || '').trim())
  ) {
    throw new Error('Every starting location needs a unique code and non-empty name');
  }

  const clue1Variants = parseJsonArray(
    env.CAMPUS_HUNT_CLUE1_VARIANTS,
    'CAMPUS_HUNT_CLUE1_VARIANTS',
  );
  const production = env.NODE_ENV === 'production';
  if (production && configuredLocations.length !== startCount) {
    throw new Error('Production seed requires explicit CAMPUS_HUNT_STARTING_LOCATIONS');
  }
  if (production && clue1Variants.length !== startCount * ROUTE_KEYS.length) {
    throw new Error(
      `Production seed requires ${startCount * ROUTE_KEYS.length} explicit Clue 1 variants`,
    );
  }
  if (production) {
    const expectedVariantKeys = new Set(
      normalizedCodes.flatMap((code) => ROUTE_KEYS.map((routeKey) => `${code}/${routeKey}`)),
    );
    const actualVariantKeys = new Set(clue1Variants.map((variant) => (
      `${String(variant.startingPointCode || '').trim().toUpperCase()}/`
      + `${String(variant.routeKey || '').trim().toUpperCase()}`
    )));
    if (
      actualVariantKeys.size !== expectedVariantKeys.size
      || [...expectedVariantKeys].some((key) => !actualVariantKeys.has(key))
    ) {
      throw new Error('Production Clue 1 variants must cover every start/route exactly once');
    }
  }

  return {
    startCount,
    startCapacity,
    releaseIntervalMinutes,
    teamCapacity,
    startsAt,
    locations: locations.map((location, index) => ({
      ...location,
      code: normalizedCodes[index],
      name: String(location.name).trim(),
    })),
    clue1Variants,
    production,
  };
}

const ROUTE_VARIANTS = {
  A: {
    clue1: {
      prompt: 'Thousands of stories live here, but none of them can speak. Find me.',
      answer: 'library',
      acceptedAnswers: ['library', 'the library', 'central library', 'librbay'],
      destinationInstruction:
        'Go to the library. Find the Campus Hunt station QR. ALL 4 members must scan it to unlock Clue 2.',
    },
    clue2: {
      prompt: 'Find the hidden 3-digit number inside the defined area.',
      answer: '482',
      destinationInstruction:
        'Next location: Cafeteria entrance. All 4 members must scan the station QR to unlock the decode clue.',
    },
    clue3: { prompt: 'Decode: KHOOR', answer: 'hello' },
    cp2: {
      locationName: 'Cafeteria entrance',
      publicInstruction:
        'You are at Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
    },
    clue4: {
      memberPrompts: [
        'Piece A: The first letter is C',
        'Piece B: The second letter is R',
        'Piece C: The third letter is W',
        'Piece D: The last letter is D',
      ],
      answer: 'crwd',
    },
  },
  B: {
    clue1: {
      prompt: 'I have courts but no king, nets but no fish. Find me.',
      answer: 'sports complex',
      acceptedAnswers: ['sports complex', 'sports ground', 'court', 'tennis court'],
      destinationInstruction:
        'Go to the sports complex gate. Find the Campus Hunt station QR. ALL 4 members must scan it to unlock Clue 2.',
    },
    clue2: {
      prompt: 'Find the hidden 3-digit number inside the defined area.',
      answer: '719',
      destinationInstruction:
        'Next location: Main gate notice board. All 4 members must scan the station QR to unlock the decode clue.',
    },
    clue3: { prompt: 'Decode: ZRUOG', answer: 'world' },
    cp2: {
      locationName: 'Main gate notice board',
      publicInstruction:
        'You are at Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
    },
    clue4: {
      memberPrompts: [
        'Piece A: Start with H',
        'Piece B: Then U',
        'Piece C: Then N',
        'Piece D: End with T',
      ],
      answer: 'hunt',
    },
  },
  C: {
    clue1: {
      prompt: 'Where ideas brew hotter than coffee and boards fill with plans. Find me.',
      answer: 'cafeteria',
      acceptedAnswers: ['cafeteria', 'canteen', 'cafe'],
      destinationInstruction:
        'Go outside the cafeteria. Find the Campus Hunt station QR. ALL 4 members must scan it to unlock Clue 2.',
    },
    clue2: {
      prompt: 'Find the hidden 3-digit number inside the defined area.',
      answer: '356',
      destinationInstruction:
        'Next location: Auditorium steps. All 4 members must scan the station QR to unlock the decode clue.',
    },
    clue3: { prompt: 'Decode: FDPSXV', answer: 'campus' },
    cp2: {
      locationName: 'Auditorium steps',
      publicInstruction:
        'You are at Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
    },
    clue4: {
      memberPrompts: [
        'Piece A: First syllable sounds like "team"',
        'Piece B: Middle has "work"',
        'Piece C: You need all four voices',
        'Piece D: Final answer is one word: teamwork',
      ],
      answer: 'teamwork',
    },
  },
  D: {
    clue1: {
      prompt: 'Flags rise here and footsteps echo in formation. Find me.',
      answer: 'auditorium',
      acceptedAnswers: ['auditorium', 'main auditorium', 'amphitheatre', 'amphitheater'],
      destinationInstruction:
        'Go to the auditorium steps. Find the Campus Hunt station QR. ALL 4 members must scan it to unlock Clue 2.',
    },
    clue2: {
      prompt: 'Find the hidden 3-digit number inside the defined area.',
      answer: '841',
      destinationInstruction:
        'Next location: Sports complex gate. All 4 members must scan the station QR to unlock the decode clue.',
    },
    clue3: { prompt: 'Decode: FRQWURO', answer: 'control' },
    cp2: {
      locationName: 'Sports complex gate',
      publicInstruction:
        'You are at Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
    },
    clue4: {
      memberPrompts: [
        'Piece A: Color of victory is not needed',
        'Piece B: Combine: FIN + ISH',
        'Piece C: No spaces',
        'Piece D: Answer lowercase',
      ],
      answer: 'finish',
    },
  },
};

function clue1Definition(config, startingPoint, routeKey) {
  const explicit = config.clue1Variants.find((item) => (
    String(item.startingPointCode || '').trim().toUpperCase() === startingPoint.code
    && String(item.routeKey || '').trim().toUpperCase() === routeKey
  ));
  if (explicit) {
    const checkpoint = explicit.firstCheckpoint || {};
    const required = [
      explicit.prompt,
      explicit.answer,
      explicit.destinationInstruction,
      checkpoint.code,
      checkpoint.locationName,
    ];
    if (required.some((value) => !String(value || '').trim())) {
      throw new Error(
        `Incomplete Clue 1 variant for ${startingPoint.code}/${routeKey}`,
      );
    }
    return {
      ...explicit,
      acceptedAnswers: explicit.acceptedAnswers || [explicit.answer],
      firstCheckpoint: checkpoint,
    };
  }
  if (config.production) {
    throw new Error(`Missing Clue 1 variant for ${startingPoint.code}/${routeKey}`);
  }
  const fallback = ROUTE_VARIANTS[routeKey].clue1;
  return {
    ...fallback,
    difficulty: 'medium',
    firstCheckpoint: {
      code: `${startingPoint.code}-${routeKey}-CP1`,
      locationName: String(fallback.answer)
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      publicInstruction:
        'Assigned Checkpoint 1. All 4 members scan this station QR to unlock Clue 2.',
    },
  };
}

async function main() {
  const config = readSeedConfig();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const resetRequested =
    process.argv.includes('--reset')
    && String(process.env.CAMPUS_HUNT_SEED_RESET).toLowerCase() === 'true';
  if (resetRequested) {
    const existing = await CampusHuntEvent.findOne({ slug: SLUG });
    if (existing) {
      const id = existing._id;
      const teams = await CampusHuntTeam.find({ eventId: id }).select('_id');
      const teamIds = teams.map((team) => team._id);
      const rosterTeams = await CampusHuntTeam.find({ eventId: id })
        .select('leaderUserId memberUserIds');
      const rosterUserIds = rosterTeams.flatMap((team) => [
        team.leaderUserId,
        ...(team.memberUserIds || []),
      ]);
      await Promise.all([
        CampusHuntTeamProgress.deleteMany({ teamId: { $in: teamIds } }),
        CampusHuntCheckpointVerification.deleteMany({ eventId: id }),
        CampusHuntIssueReport.deleteMany({ eventId: id }),
        CampusHuntAuditLog.deleteMany({ eventId: id }),
        CampusHuntTeam.deleteMany({ eventId: id }),
        User.deleteMany({
          _id: { $in: rosterUserIds },
          email: /@hunt\.crwdctrl\.local$/i,
        }),
        CampusHuntChallenge.deleteMany({ eventId: id }),
        CampusHuntCheckpoint.deleteMany({ eventId: id }),
        CampusHuntVolunteerAccess.deleteMany({ eventId: id }),
        CampusHuntStartingPoint.deleteMany({ eventId: id }),
        CampusHuntRoute.deleteMany({ eventId: id }),
        CampusHuntRound.deleteMany({ eventId: id }),
        CampusHuntEvent.deleteOne({ _id: id }),
      ]);
      console.log('Reset existing pilot event');
    }
  }

  let event = await CampusHuntEvent.findOne({ slug: SLUG });
  if (!event) {
    event = await CampusHuntEvent.create({
      name: 'CRWDCtrl Campus Hunt — Pilot',
      college: 'Pilot College',
      slug: SLUG,
      date: new Date(),
      status: 'registration_open',
      teamCapacity: config.teamCapacity,
      teamSize: 4,
      startingScore: 100,
      scoringConfig: { ...DEFAULT_SCORING_CONFIG },
      featureNotes: 'Pilot seed — assign real users via admin before going live',
    });
    console.log('Created event', event._id.toString());
  } else {
    console.log('Using existing event', event._id.toString());
    if (event.teamCapacity !== config.teamCapacity) {
      event.teamCapacity = config.teamCapacity;
      await event.save();
    }
  }

  let round = await CampusHuntRound.findOne({ eventId: event._id, roundNumber: 1 });
  if (!round) {
    round = await CampusHuntRound.create({
      eventId: event._id,
      roundNumber: 1,
      name: 'THE_HUNT',
      status: 'scheduled',
      startsAt: config.startsAt,
      releaseIntervalMinutes: config.releaseIntervalMinutes,
      assignmentStrategy: 'route_balanced',
      scheduleStatus: 'draft',
      releasesPaused: false,
      qualification: {
        topNDirectFinale: 5,
        survivalTeams: 35,
        lastChanceTeams: 0,
        finaleTeams: 12,
        nextRoundName: 'SURVIVAL_STAGE',
      },
    });
    console.log('Created round 1');
  } else if (round.scheduleStatus !== 'locked') {
    round.startsAt = config.startsAt;
    round.releaseIntervalMinutes = config.releaseIntervalMinutes;
    round.assignmentStrategy = 'route_balanced';
    await round.save();
  }

  const startingPoints = [];
  for (let index = 0; index < config.locations.length; index += 1) {
    const location = config.locations[index];
    // eslint-disable-next-line no-await-in-loop
    const point = await CampusHuntStartingPoint.findOneAndUpdate(
      { eventId: event._id, code: location.code },
      {
        $set: {
          eventId: event._id,
          roundId: round._id,
          code: location.code,
          name: location.name,
          description: String(location.description || ''),
          capacity: config.startCapacity,
          displayOrder: index,
          active: true,
          releasesPaused: false,
        },
      },
      { upsert: true, new: true },
    );
    startingPoints.push(point);
  }

  const routeIds = {};
  for (const key of ROUTE_KEYS) {
    let route = await CampusHuntRoute.findOne({ eventId: event._id, routeKey: key });
    if (!route) {
      route = await CampusHuntRoute.create({
        eventId: event._id,
        routeKey: key,
        name: `Route ${key}`,
        teamSlots: Math.ceil(config.teamCapacity / ROUTE_KEYS.length),
        active: true,
      });
    } else if (route.teamSlots !== Math.ceil(config.teamCapacity / ROUTE_KEYS.length)) {
      route.teamSlots = Math.ceil(config.teamCapacity / ROUTE_KEYS.length);
      await route.save();
    }
    routeIds[key] = route._id;

    const v = ROUTE_VARIANTS[key];
    const scoring = DEFAULT_SCORING_CONFIG;

    for (const startingPoint of startingPoints) {
      const definition = clue1Definition(config, startingPoint, key);
      const checkpointCode = String(definition.firstCheckpoint.code).trim().toUpperCase();
      // eslint-disable-next-line no-await-in-loop
      const firstCheckpoint = await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId: event._id, code: checkpointCode },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            startingPointId: startingPoint._id,
            code: checkpointCode,
            progressionKey: '1',
            checkpointNumber: 1,
            checkpointKey: `1-${startingPoint.code}`,
            locationName: String(definition.firstCheckpoint.locationName).trim(),
            publicInstruction: String(
              definition.firstCheckpoint.publicInstruction
              || 'Assigned Checkpoint 1. All 4 members scan to unlock Clue 2.',
            ),
            sequence: 1,
            capacityGuidance: config.startCapacity,
            concurrencyGuidance:
              `Expect up to ${config.startCapacity} assigned teams, released every `
              + `${config.releaseIntervalMinutes} minute(s).`,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
          },
        },
        { upsert: true, new: true },
      );
      const variantKey = `${startingPoint.code}-${key}-C1`;
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
            prompt: definition.prompt,
            answer: definition.answer,
            acceptedAnswers: definition.acceptedAnswers,
            destinationInstruction: definition.destinationInstruction,
            basePoints: 0,
            maxAttempts: scoring.clue1?.maxAttempts || 3,
            timerSeconds: 0,
            hintText: '',
            hintCost: 0,
            difficulty: definition.difficulty || 'medium',
            variantKey,
            active: true,
          },
        },
        { upsert: true },
      );
    }

    await CampusHuntChallenge.findOneAndUpdate(
      {
        eventId: event._id,
        roundId: round._id,
        routeId: route._id,
        challengeNumber: 2,
        variantKey: 'DEFAULT',
      },
      {
        $set: {
          eventId: event._id,
          roundId: round._id,
          routeId: route._id,
          challengeNumber: 2,
          type: 'timed_search',
          prompt: v.clue2.prompt,
          answer: v.clue2.answer,
          destinationInstruction: v.clue2.destinationInstruction,
          basePoints: 0,
          maxAttempts: scoring.clue2.maxAttempts,
          timerSeconds: 180,
          speedBonusBands: scoring.clue2.speedBonusBands,
          hintText: 'Look near eye level on marked posts.',
          hintCost: scoring.hintCost,
          difficulty: 'medium',
          variantKey: 'DEFAULT',
          active: true,
        },
      },
      { upsert: true },
    );

    await CampusHuntChallenge.findOneAndUpdate(
      {
        eventId: event._id,
        roundId: round._id,
        routeId: route._id,
        challengeNumber: 3,
        variantKey: 'DEFAULT',
      },
      {
        $set: {
          eventId: event._id,
          roundId: round._id,
          routeId: route._id,
          challengeNumber: 3,
          type: 'decode',
          prompt: v.clue3.prompt,
          answer: v.clue3.answer,
          destinationInstruction: 'Proceed to Checkpoint 3.',
          basePoints: scoring.clue3.basePoints,
          maxAttempts: scoring.clue3.maxAttempts,
          timerSeconds: 0,
          hintText: 'Each letter is shifted by the same amount (Caesar).',
          hintCost: scoring.hintCost,
          difficulty: 'medium',
          variantKey: 'DEFAULT',
          active: true,
        },
      },
      { upsert: true },
    );

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
          challengeNumber: 4,
          type: 'collaborative',
          prompt: 'Combine all four pieces to form the answer.',
          memberPrompts: v.clue4.memberPrompts,
          answer: v.clue4.answer,
          destinationInstruction: 'All members report to the Finish Zone.',
          basePoints: scoring.clue4.basePoints,
          maxAttempts: scoring.clue4.maxAttempts,
          timerSeconds: scoring.clue4.timerSeconds,
          speedBonusBands: scoring.clue4.speedBonusBands,
          hintText: 'Speak every piece out loud — order matters.',
          hintCost: scoring.hintCost,
          difficulty: 'hard',
          variantKey: 'DEFAULT',
          active: true,
        },
      },
      { upsert: true },
    );

    const cps = [
      {
        key: '2',
        num: 2,
        seq: 2,
        name: v.cp2?.locationName || `Route ${key} Checkpoint 2`,
        instruction:
          v.cp2?.publicInstruction
          || 'Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
      },
      {
        key: '3',
        num: 3,
        seq: 3,
        name: {
          A: 'Student Activity Centre',
          B: 'Academic Block Courtyard',
          C: 'Main Lawn Help Desk',
          D: 'Innovation Centre Lobby',
        }[key],
        instruction: 'Checkpoint 3. All 4 members scan to unlock the final clue.',
      },
      {
        key: 'FINISH',
        num: 4,
        seq: 4,
        name: 'Central Finish Arena',
        instruction: 'Finish Zone. All 4 members scan to lock your score.',
      },
    ];
    for (const cp of cps) {
      await CampusHuntCheckpoint.findOneAndUpdate(
        { eventId: event._id, routeId: route._id, checkpointKey: cp.key },
        {
          $set: {
            eventId: event._id,
            roundId: round._id,
            routeId: route._id,
            code: `R${key}-${cp.key}`,
            progressionKey: cp.key,
            checkpointNumber: cp.num,
            checkpointKey: cp.key,
            locationName: cp.name,
            publicInstruction: cp.instruction,
            sequence: cp.seq,
            capacityGuidance: config.teamCapacity,
            concurrencyGuidance:
              `Shared route station; monitor flow for up to ${config.teamCapacity} teams.`,
            active: true,
            compensationPolicyKey: 'skip_and_continue',
          },
        },
        { upsert: true },
      );
    }
  }

  await Promise.all([
    CampusHuntChallenge.updateMany(
      {
        eventId: event._id,
        roundId: round._id,
        challengeNumber: 1,
        $or: [{ startingPointId: { $exists: false } }, { startingPointId: null }],
      },
      { $set: { active: false } },
    ),
    CampusHuntCheckpoint.updateMany(
      {
        eventId: event._id,
        roundId: round._id,
        checkpointNumber: 1,
        $or: [{ startingPointId: { $exists: false } }, { startingPointId: null }],
      },
      { $set: { active: false } },
    ),
  ]);

  const existingTeams = await CampusHuntTeam.find({ eventId: event._id }).sort({ teamCode: 1 });
  if (existingTeams.length > config.teamCapacity) {
    throw new Error(
      `${existingTeams.length} existing teams exceed configured capacity ${config.teamCapacity}`,
    );
  }
  if (round.scheduleStatus === 'locked') {
    const incomplete = existingTeams.filter((team) => (
      !team.startingPointId
      || !team.routeId
      || !team.scheduledStartAt
      || !team.clue1ChallengeId
      || !team.firstCheckpointId
    ));
    if (incomplete.length) {
      throw new Error(
        `Locked schedule has ${incomplete.length} incomplete team assignment(s); `
        + 'unlock/regenerate through Admin instead of reseeding',
      );
    }
    console.log('Schedule is locked; preserved existing team assignments');
  } else if (existingTeams.length) {
    const [routes, variants] = await Promise.all([
      CampusHuntRoute.find({ eventId: event._id, active: true }),
      CampusHuntChallenge.find({
        eventId: event._id,
        roundId: round._id,
        challengeNumber: 1,
        active: true,
      }),
    ]);
    const assignments = buildDeterministicSchedule({
      teams: existingTeams,
      startingPoints,
      routes,
      variants,
      startsAt: config.startsAt,
      releaseIntervalMinutes: config.releaseIntervalMinutes,
      assignmentStrategy: 'route_balanced',
    });
    if (assignments.some((assignment) => !assignment.complete)) {
      throw new Error('Cannot seed schedule: one or more teams lack a complete Clue 1 assignment');
    }
    await CampusHuntCheckpoint.updateMany(
      { eventId: event._id, roundId: round._id, progressionKey: '1' },
      { $set: { allowedTeamIds: [] } },
    );
    for (const assignment of assignments) {
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntTeam.updateOne(
        { _id: assignment.teamId, eventId: event._id },
        {
          $set: {
            roundId: round._id,
            routeId: assignment.routeId,
            startingPointId: assignment.startingPointId,
            scheduledStartAt: assignment.scheduledStartAt,
            clue1ChallengeId: assignment.clue1ChallengeId,
            firstCheckpointId: assignment.firstCheckpointId,
            startStatus: 'WAITING',
            currentStage: 'WAITING',
          },
          $unset: { actualStartAt: 1 },
        },
      );
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntCheckpoint.updateOne(
        { _id: assignment.firstCheckpointId },
        { $addToSet: { allowedTeamIds: assignment.teamId } },
      );
    }
    console.log(`Generated draft staggered schedule for ${assignments.length} team(s)`);
  }

  const checkpoints = await CampusHuntCheckpoint.find({
    eventId: event._id,
    active: true,
  }).populate('routeId');
  const unboundVolunteers = await CampusHuntVolunteerAccess.find({ eventId: event._id });
  for (const volunteer of unboundVolunteers) {
    if (!volunteer.checkpointIds?.length) {
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntVolunteerAccess.deleteOne({ _id: volunteer._id });
    }
  }
  const volunteerCredentials = [];
  for (const checkpoint of checkpoints) {
    const code = `VOL-${checkpoint.code || `${checkpoint.routeId.routeKey}-${checkpoint.checkpointKey}`}`;
    const password = process.env.CAMPUS_HUNT_VOLUNTEER_PASSWORD
      || crypto.randomBytes(6).toString('base64url');
    // eslint-disable-next-line no-await-in-loop
    const passwordHash = await CampusHuntVolunteerAccess.hashPassword(password);
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntVolunteerAccess.findOneAndUpdate(
      { eventId: event._id, code },
      {
        $set: {
          eventId: event._id,
          code,
          passwordHash,
          label: `${checkpoint.routeId.routeKey} · ${checkpoint.locationName}`,
          checkpointIds: [checkpoint._id],
          enabled: true,
        },
      },
      { upsert: true, new: true },
    );
    volunteerCredentials.push({ code, password, checkpoint: checkpoint.locationName });
  }

  console.log('--- Pilot seed complete ---');
  console.log('Event slug:', SLUG);
  console.log('Event ID:', event._id.toString());
  console.log('Round ID:', round._id.toString());
  console.log(
    `Starts: ${config.startCount} × ${config.startCapacity}; `
    + `interval: ${config.releaseIntervalMinutes} minute(s)`,
  );
  console.log('Checkpoint-bound volunteer credentials:', volunteerCredentials);
  console.log(`Capacity: ${config.teamCapacity} teams. Preview, generate, then lock in Admin.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
}

module.exports = {
  argumentValue,
  positiveInteger,
  parseJsonArray,
  readSeedConfig,
  clue1Definition,
};
