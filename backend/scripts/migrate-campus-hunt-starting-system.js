require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const Round = require('../src/modules/campus-hunt/models/CampusHuntRound');
const Route = require('../src/modules/campus-hunt/models/CampusHuntRoute');
const Team = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const Challenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
const Checkpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');

async function dropIndexIfPresent(collection, name) {
  try {
    await collection.dropIndex(name);
  } catch (error) {
    if (error.codeName !== 'IndexNotFound' && error.code !== 27) throw error;
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  await dropIndexIfPresent(Challenge.collection, 'eventId_1_routeId_1_challengeNumber_1');
  await dropIndexIfPresent(Checkpoint.collection, 'eventId_1_routeId_1_checkpointKey_1');

  const events = await Event.find().select('_id');
  let challengeCount = 0;
  let checkpointCount = 0;
  for (const event of events) {
    const routes = await Route.find({ eventId: event._id }).select('routeKey');
    const routeKeys = new Map(routes.map((route) => [String(route._id), route.routeKey]));
    const challenges = await Challenge.find({ eventId: event._id });
    for (const challenge of challenges) {
      challenge.variantKey = String(challenge.variantKey || 'DEFAULT').trim().toUpperCase();
      // eslint-disable-next-line no-await-in-loop
      await challenge.save();
      challengeCount += 1;
    }
    const checkpoints = await Checkpoint.find({ eventId: event._id });
    for (const checkpoint of checkpoints) {
      const routeKey = routeKeys.get(String(checkpoint.routeId)) || 'ROUTE';
      const progressionKey = String(
        checkpoint.progressionKey || checkpoint.checkpointKey || checkpoint.checkpointNumber,
      ).toUpperCase();
      checkpoint.progressionKey = progressionKey === '4' ? 'FINISH' : progressionKey;
      checkpoint.code = checkpoint.code
        || `CP-${routeKey}-${checkpoint.progressionKey}`;
      // eslint-disable-next-line no-await-in-loop
      await checkpoint.save();
      checkpointCount += 1;
    }
    await Team.updateMany(
      { eventId: event._id, startStatus: { $exists: false } },
      { $set: { startStatus: 'WAITING' } },
    );
    await Round.updateMany(
      { eventId: event._id, scheduleStatus: { $exists: false } },
      {
        $set: {
          scheduleStatus: 'draft',
          releaseIntervalMinutes: 2,
          assignmentStrategy: 'route_balanced',
          releasesPaused: false,
        },
      },
    );
  }

  await Promise.all([Challenge.syncIndexes(), Checkpoint.syncIndexes()]);
  console.log(`Migrated ${challengeCount} challenges and ${checkpointCount} checkpoints`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
