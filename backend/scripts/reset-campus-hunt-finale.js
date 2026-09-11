/**
 * Reset Campus Hunt Finale for local playtesting — turn round off and wipe team progress.
 *
 * Usage:
 *   node scripts/reset-campus-hunt-finale.js
 *   node scripts/reset-campus-hunt-finale.js 6a776d65500265387d6b8a86
 */
require('dotenv').config();
const mongoose = require('mongoose');

const eventIdArg = process.argv[2] || '6a776d65500265387d6b8a86';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI missing in backend/.env');
  }

  await mongoose.connect(uri);
  require('../src/modules/campus-hunt/models');
  const { registerModels } = require('../src/modules/campus-hunt/models');
  registerModels();

  const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
  const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
  const CampusHuntFinaleEntry = require('../src/modules/campus-hunt/models/CampusHuntFinaleEntry');
  const CampusHuntFinaleMissionRun = require('../src/modules/campus-hunt/models/CampusHuntFinaleMissionRun');
  const CampusHuntFinaleMissionConfig = require('../src/modules/campus-hunt/models/CampusHuntFinaleMissionConfig');
  const CampusHuntGridSession = require('../src/modules/campus-hunt/models/CampusHuntGridSession');
  const { FINALE_DEFAULTS, FINALE_MISSION_BOARD } = require('../src/modules/campus-hunt/constants');

  const eventId = new mongoose.Types.ObjectId(eventIdArg);
  const event = await CampusHuntEvent.findById(eventId);
  if (!event) {
    throw new Error(`Event not found: ${eventIdArg}`);
  }

  const round = await CampusHuntRound.findOne({ eventId, name: 'FINALE' });
  if (!round) {
    throw new Error('No FINALE round — bootstrap Finale in admin first.');
  }

  const starting = FINALE_DEFAULTS.startingScore;

  // 1) Turn finals off
  round.status = 'scheduled';
  round.scheduleStatus = 'draft';
  round.startsAt = undefined;
  round.endsAt = undefined;
  round.scheduleLockedAt = undefined;
  round.releasesPaused = false;
  round.markModified('startsAt');
  round.markModified('endsAt');
  round.markModified('scheduleLockedAt');
  await round.save();

  // Also $unset date fields that undefined+save may leave behind
  await CampusHuntRound.updateOne(
    { _id: round._id },
    {
      $set: {
        status: 'scheduled',
        scheduleStatus: 'draft',
        releasesPaused: false,
      },
      $unset: {
        startsAt: 1,
        endsAt: 1,
        scheduleLockedAt: 1,
        lockedAt: 1,
      },
    },
  );

  // 2) Reset all finale entries
  const entryResult = await CampusHuntFinaleEntry.updateMany(
    { eventId },
    {
      $set: {
        status: 'eligible',
        completedMissionIds: [],
        activeMissionId: null,
        activeMissionRunId: null,
        finaleScore: starting,
      },
      $unset: {
        finalScore: 1,
        stoppedAt: 1,
        lockedAt: 1,
        releasedAt: 1,
        scheduledStartAt: 1,
        meetLocationCode: 1,
        meetLocationName: 1,
        finaleSlot: 1,
        releaseWave: 1,
      },
    },
  );

  // 3) Abandon mission runs
  const runResult = await CampusHuntFinaleMissionRun.updateMany(
    { eventId, status: { $in: ['active', 'completed'] } },
    { $set: { status: 'abandoned' } },
  );

  // 4) Expire grid sessions
  const gridResult = await CampusHuntGridSession.updateMany(
    { eventId, status: { $in: ['active', 'completed'] } },
    { $set: { status: 'expired' } },
  );

  // 5) Normalize mission board ids (borrowed_device → field_terminal)
  const config = await CampusHuntFinaleMissionConfig.findOne({ eventId });
  if (config) {
    let dirty = false;
    const missions = Array.isArray(config.missions) ? config.missions : [];
    for (const row of missions) {
      if (row?.id === 'borrowed_device') {
        row.id = 'field_terminal';
        row.title = 'Field Terminal';
        dirty = true;
      }
    }
    if (!missions.length) {
      config.missions = FINALE_MISSION_BOARD.map((m) => ({ ...m }));
      dirty = true;
    }
    if (dirty) {
      config.markModified('missions');
      await config.save();
    }
  }

  // Keep event in a playable status (not stuck on finale-complete)
  if (event.status === 'finale' || event.status === 'completed') {
    event.status = 'live';
    await event.save();
  }

  console.log('Finale reset OK');
  console.log({
    eventId: String(eventId),
    eventName: event.name,
    roundId: String(round._id),
    roundStatus: 'scheduled',
    scheduleStatus: 'draft',
    entriesReset: entryResult.modifiedCount,
    runsAbandoned: runResult.modifiedCount,
    gridsExpired: gridResult.modifiedCount,
    startingScore: starting,
  });
  console.log('\nNext in Admin → Finale:');
  console.log('1. Schedule → Generate → Lock');
  console.log('2. Start Finals');
  console.log('3. Live → Release team (or wait for wave)');
  console.log('4. Leader starts Intel / Field Terminal');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Reset failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
