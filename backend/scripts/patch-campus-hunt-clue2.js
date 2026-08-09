require('dotenv').config();
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');
const { DEFAULT_SCORING_CONFIG } = require('../src/modules/campus-hunt/constants');
const { buildStationQrPayload } = require('../src/modules/campus-hunt/services/checkpointService');

registerModels();

const Event = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const Challenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
const Checkpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const Route = require('../src/modules/campus-hunt/models/CampusHuntRoute');

const BY_ROUTE = {
  A: {
    clue1: {
      prompt: 'Thousands of stories live here, but none of them can speak. Find me.',
      acceptedAnswers: ['library', 'the library', 'central library', 'librbay'],
      destinationInstruction:
        'Go to the library. Find the Campus Hunt station QR. ALL 4 members must scan it to unlock Clue 2.',
    },
    clue2: {
      destinationInstruction:
        'Next location: Cafeteria entrance. All 4 members must scan the station QR to unlock the decode clue.',
    },
    cp1: {
      locationName: 'Library',
      publicInstruction: 'Checkpoint 1. All 4 members scan this station QR to unlock Clue 2.',
    },
    cp2: {
      locationName: 'Cafeteria entrance',
      publicInstruction:
        'You are at Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
    },
  },
  B: {
    clue1: {
      prompt: 'I have courts but no king, nets but no fish. Find me.',
      acceptedAnswers: ['sports complex', 'sports ground', 'court', 'tennis court'],
      destinationInstruction:
        'Go to the sports complex gate. Find the Campus Hunt station QR. ALL 4 members must scan it to unlock Clue 2.',
    },
    clue2: {
      destinationInstruction:
        'Next location: Main gate notice board. All 4 members must scan the station QR to unlock the decode clue.',
    },
    cp1: {
      locationName: 'Sports complex gate',
      publicInstruction: 'Checkpoint 1. All 4 members scan this station QR to unlock Clue 2.',
    },
    cp2: {
      locationName: 'Main gate notice board',
      publicInstruction:
        'You are at Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
    },
  },
  C: {
    clue1: {
      prompt: 'Where ideas brew hotter than coffee and boards fill with plans. Find me.',
      acceptedAnswers: ['cafeteria', 'canteen', 'cafe'],
      destinationInstruction:
        'Go outside the cafeteria. Find the Campus Hunt station QR. ALL 4 members must scan it to unlock Clue 2.',
    },
    clue2: {
      destinationInstruction:
        'Next location: Auditorium steps. All 4 members must scan the station QR to unlock the decode clue.',
    },
    cp1: {
      locationName: 'Cafeteria',
      publicInstruction: 'Checkpoint 1. All 4 members scan this station QR to unlock Clue 2.',
    },
    cp2: {
      locationName: 'Auditorium steps',
      publicInstruction:
        'You are at Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
    },
  },
  D: {
    clue1: {
      prompt: 'Flags rise here and footsteps echo in formation. Find me.',
      acceptedAnswers: ['auditorium', 'main auditorium', 'amphitheatre', 'amphitheater'],
      destinationInstruction:
        'Go to the auditorium steps. Find the Campus Hunt station QR. ALL 4 members must scan it to unlock Clue 2.',
    },
    clue2: {
      destinationInstruction:
        'Next location: Sports complex gate. All 4 members must scan the station QR to unlock the decode clue.',
    },
    cp1: {
      locationName: 'Auditorium steps',
      publicInstruction: 'Checkpoint 1. All 4 members scan this station QR to unlock Clue 2.',
    },
    cp2: {
      locationName: 'Sports complex gate',
      publicInstruction:
        'You are at Checkpoint 2. All 4 members scan this station QR to unlock Clue 3 (decode).',
    },
  },
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const event = await Event.findOne({ slug: 'pilot-campus-hunt' });
  if (!event) {
    console.error('No pilot event');
    process.exit(1);
  }

  event.scoringConfig = { ...DEFAULT_SCORING_CONFIG };
  await event.save();

  const routes = await Route.find({ eventId: event._id });
  for (const route of routes) {
    const key = String(route.routeKey || 'A').toUpperCase();
    const cfg = BY_ROUTE[key] || BY_ROUTE.A;

    await Challenge.updateOne(
      { eventId: event._id, routeId: route._id, challengeNumber: 1 },
      {
        $set: {
          maxAttempts: DEFAULT_SCORING_CONFIG.clue1.maxAttempts,
          prompt: cfg.clue1.prompt,
          acceptedAnswers: cfg.clue1.acceptedAnswers,
          destinationInstruction: cfg.clue1.destinationInstruction,
        },
      },
    );

    await Challenge.updateOne(
      { eventId: event._id, routeId: route._id, challengeNumber: 2 },
      {
        $set: {
          basePoints: 0,
          timerSeconds: 300,
          speedBonusBands: DEFAULT_SCORING_CONFIG.clue2.speedBonusBands,
          destinationInstruction: cfg.clue2.destinationInstruction,
        },
      },
    );

    await Checkpoint.updateOne(
      { eventId: event._id, routeId: route._id, checkpointKey: '1' },
      {
        $set: {
          locationName: cfg.cp1.locationName,
          publicInstruction: cfg.cp1.publicInstruction,
        },
      },
    );

    await Checkpoint.updateOne(
      { eventId: event._id, routeId: route._id, checkpointKey: '2' },
      {
        $set: {
          locationName: cfg.cp2.locationName,
          publicInstruction: cfg.cp2.publicInstruction,
        },
      },
    );
  }

  const cp1 = await Checkpoint.findOne({
    eventId: event._id,
    checkpointKey: '1',
  }).populate('routeId').select('+qrSecret');
  const cp2 = await Checkpoint.findOne({
    eventId: event._id,
    checkpointKey: '2',
  }).populate('routeId').select('+qrSecret');

  console.log('Patched clue1/clue2/cp1/cp2 for all routes');
  if (cp1) {
    console.log('SAMPLE_STATION_QR_CP1=', buildStationQrPayload(cp1));
  }
  if (cp2) {
    console.log('SAMPLE_STATION_QR_CP2=', buildStationQrPayload(cp2));
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
