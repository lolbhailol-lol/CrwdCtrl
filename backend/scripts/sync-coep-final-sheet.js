/**
 * Align the COEP Campus Hunt event with TreasureHuntAnswers [FINAL].
 *
 * Dry run (default): node scripts/sync-coep-final-sheet.js
 * Apply:             node scripts/sync-coep-final-sheet.js --apply
 * Restore backup:    node scripts/sync-coep-final-sheet.js --restore=tmp/<backup>.json
 *
 * This intentionally does not touch leader names, users, emails, passwords, scores, or progress.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');

registerModels();

const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
const CampusHuntChallenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const { bulkSaveClue5 } = require('../src/modules/campus-hunt/services/clue5BulkSaveService');
const {
  DEFAULT_CAMPUS_STATIONS,
  DEFAULT_STATION_DIGIT_CODES,
  splitDigitSlips,
} = require('../src/modules/campus-hunt/services/stationCatalogService');

const SLUG = 'coep-campus-hunt';
const LOCKBOX_CODES = [
  '9407', '3815', '7264', '1598', '6032', '8471', '2956', '4713', '5180', '0629',
  '7346', '1864', '2538', '6901', '8142', '3075', '4286', '1756', '8630', '5924',
];
const FINAL_WORDS = [
  'QUEST', 'BLAZE', 'SPARK', 'PRIDE', 'FLAME', 'CROWN', 'STORM', 'RIVER', 'NORTH', 'LIGHT',
  'BRAVE', 'FOCUS', 'PULSE', 'SWIFT', 'GLINT', 'FORGE', 'ECHO', 'VISTA', 'NOVA', 'DASH',
];

function argValue(name) {
  const prefix = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function objectId(value) {
  return new mongoose.Types.ObjectId(String(value));
}

async function snapshot(event) {
  const [checkpoints, challenges, teams] = await Promise.all([
    CampusHuntCheckpoint.find({ eventId: event._id }).lean(),
    CampusHuntChallenge.find({ eventId: event._id, challengeNumber: { $in: [1, 2, 3, 5] } })
      .select('+answer +acceptedAnswers')
      .lean(),
    CampusHuntTeam.find({ eventId: event._id }).select('_id clue5ChallengeId').lean(),
  ]);
  return {
    createdAt: new Date().toISOString(),
    eventId: String(event._id),
    campusStations: event.campusStations?.toObject?.() || event.campusStations || [],
    checkpoints: checkpoints.map((row) => ({
      _id: String(row._id),
      locationName: row.locationName,
      joinedWord: row.joinedWord,
      plantFragments: row.plantFragments,
    })),
    challenges: challenges.map((row) => ({
      _id: String(row._id),
      challengeNumber: row.challengeNumber,
      variantKey: row.variantKey,
      answer: row.answer,
      acceptedAnswers: row.acceptedAnswers,
      active: row.active,
    })),
    teams: teams.map((row) => ({
      _id: String(row._id),
      clue5ChallengeId: row.clue5ChallengeId ? String(row.clue5ChallengeId) : null,
    })),
  };
}

async function restoreBackup(file) {
  const backup = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const eventId = objectId(backup.eventId);
  await CampusHuntEvent.updateOne({ _id: eventId }, { $set: { campusStations: backup.campusStations } });
  if (backup.checkpoints.length) {
    await CampusHuntCheckpoint.bulkWrite(backup.checkpoints.map((row) => ({
      updateOne: {
        filter: { _id: objectId(row._id), eventId },
        update: { $set: {
          locationName: row.locationName,
          joinedWord: row.joinedWord,
          plantFragments: row.plantFragments,
        } },
      },
    })));
  }
  const originalIds = backup.challenges.map((row) => objectId(row._id));
  await CampusHuntChallenge.deleteMany({
    eventId,
    challengeNumber: 5,
    _id: { $nin: originalIds },
  });
  if (backup.challenges.length) {
    await CampusHuntChallenge.bulkWrite(backup.challenges.map((row) => ({
      updateOne: {
        filter: { _id: objectId(row._id), eventId },
        update: { $set: {
          answer: row.answer,
          acceptedAnswers: row.acceptedAnswers,
          active: row.active,
        } },
      },
    })));
  }
  if (backup.teams.length) {
    await CampusHuntTeam.bulkWrite(backup.teams.map((row) => ({
      updateOne: {
        filter: { _id: objectId(row._id), eventId },
        update: row.clue5ChallengeId
          ? { $set: { clue5ChallengeId: objectId(row.clue5ChallengeId) } }
          : { $unset: { clue5ChallengeId: 1 } },
      },
    })));
  }
  console.log(`Restored ${file}`);
}

function expectedRows() {
  return DEFAULT_CAMPUS_STATIONS.map((station, index, stations) => ({
    teamNumber: index + 1,
    variantKey: `A-T${index + 1}`,
    clue1: station,
    clue2: stations[(index + 1) % stations.length],
    clue3: stations[(index + 2) % stations.length],
    clue4: stations[(index + 3) % stations.length],
    clue5: stations[(index + 4) % stations.length],
    clue2Answer: DEFAULT_STATION_DIGIT_CODES[stations[(index + 1) % stations.length].code],
    clue3Answer: LOCKBOX_CODES[index],
    clue5Answer: FINAL_WORDS[index],
  }));
}

async function audit(event) {
  const rows = expectedRows();
  const challenges = await CampusHuntChallenge.find({
    eventId: event._id,
    challengeNumber: { $in: [1, 2, 3, 5] },
    active: { $ne: false },
  }).select('+answer').lean();
  const byKey = new Map(challenges.map((row) => [`${row.challengeNumber}:${row.variantKey}`, row]));
  const differences = [];
  for (const row of rows) {
    const checks = [
      [1, row.clue1.name],
      [2, row.clue2Answer],
      [3, row.clue3Answer],
      [5, row.clue5Answer],
    ];
    for (const [number, expected] of checks) {
      const actual = byKey.get(`${number}:${row.variantKey}`)?.answer;
      if (String(actual || '').toUpperCase() !== String(expected).toUpperCase()) {
        differences.push({ team: row.teamNumber, clue: number, expected, actual: actual || null });
      }
    }
  }
  return differences;
}

async function applySheet(event, round) {
  const rows = expectedRows();
  const backupDir = path.join(__dirname, '../tmp');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(
    backupDir,
    `coep-final-sheet-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(backupFile, `${JSON.stringify(await snapshot(event), null, 2)}\n`);

  const currentByCode = new Map((event.campusStations || []).map((row) => [row.code, row]));
  event.campusStations = DEFAULT_CAMPUS_STATIONS.map((station) => ({
    ...(currentByCode.get(station.code)?.toObject?.() || currentByCode.get(station.code) || {}),
    ...station,
    joinedWord: DEFAULT_STATION_DIGIT_CODES[station.code],
    plantFragments: splitDigitSlips(DEFAULT_STATION_DIGIT_CODES[station.code], 3),
  }));
  event.markModified('campusStations');
  await event.save();

  for (const station of DEFAULT_CAMPUS_STATIONS) {
    const joinedWord = DEFAULT_STATION_DIGIT_CODES[station.code];
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntCheckpoint.updateMany(
      { eventId: event._id, stationCode: station.code },
      { $set: {
        locationName: station.name,
        joinedWord,
        plantFragments: splitDigitSlips(joinedWord, 3),
      } },
    );
  }

  for (const row of rows) {
    const updates = [
      [1, row.clue1.name, [row.clue1.name, row.clue1.code]],
      [2, row.clue2Answer, [row.clue2Answer]],
      [3, row.clue3Answer, [row.clue3Answer]],
    ];
    for (const [challengeNumber, answer, acceptedAnswers] of updates) {
      // eslint-disable-next-line no-await-in-loop
      const result = await CampusHuntChallenge.updateOne(
        {
          eventId: event._id,
          roundId: round._id,
          challengeNumber,
          variantKey: row.variantKey,
        },
        { $set: { answer, acceptedAnswers, active: true } },
      );
      if (result.matchedCount !== 1) {
        throw new Error(`Missing Clue ${challengeNumber} variant ${row.variantKey}`);
      }
    }
  }

  const clue5 = await bulkSaveClue5({
    eventId: event._id,
    roundId: round._id,
    actor: { actorType: 'system', actorId: 'sync-coep-final-sheet' },
    variants: rows.map((row) => ({
      startCode: 'A',
      waveId: `T${row.teamNumber}`,
      localTeamNumber: row.teamNumber,
      answer: row.clue5Answer,
    })),
  });
  if (clue5.saved !== rows.length || clue5.errors.length) {
    throw new Error(`Clue 5 sync incomplete: ${clue5.saved}/${rows.length}`);
  }
  return { backupFile, clue5 };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const restoreFile = argValue('--restore');
  if (restoreFile) {
    await restoreBackup(restoreFile);
    return;
  }

  const event = await CampusHuntEvent.findOne({ slug: SLUG });
  if (!event) throw new Error(`Event not found: ${SLUG}`);
  const round = await CampusHuntRound.findOne({ eventId: event._id, roundNumber: 1 });
  if (!round) throw new Error('Round 1 not found');

  const before = await audit(event);
  console.log(`Before: ${before.length} sheet mismatch(es)`);
  before.forEach((row) => console.log(
    `  Team ${row.team} Clue ${row.clue}: ${row.actual ?? '(missing)'} -> ${row.expected}`,
  ));

  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Re-run with --apply to update clue content and bindings.');
    return;
  }

  const result = await applySheet(event, round);
  const after = await audit(await CampusHuntEvent.findById(event._id));
  if (after.length) throw new Error(`Verification failed: ${after.length} mismatch(es) remain`);
  console.log('After: 0 sheet mismatches');
  console.log(`Backup: ${result.backupFile}`);
  console.log('Leader names, users, passwords, scores, and progress were not changed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  });
