/**
 * Refresh COEP Campus Hunt event: stations, single-game plan, bootstrap all clues.
 *
 * Usage (from repo root or backend/):
 *   node backend/scripts/refresh-coep-campus-hunt.js
 *   node backend/scripts/refresh-coep-campus-hunt.js --slug=coep-campus-hunt
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');

registerModels();

const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntChallenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const {
  DEFAULT_CAMPUS_STATIONS,
  DEFAULT_CAMPUS_STARTS,
  DEFAULT_DESTINATION_NAME,
  updateCampusStations,
} = require('../src/modules/campus-hunt/services/stationCatalogService');
const { bootstrapRound1Defaults } = require('../src/modules/campus-hunt/services/round1BootstrapService');
const { normalizeRoundPlan, deriveCompetitionFormat } = require('../src/modules/campus-hunt/utils/competitionFormat');

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');

  await mongoose.connect(uri);
  console.log('Connected');

  const slugArg = argValue('--slug');
  let events = [];
  if (slugArg) {
    const one = await CampusHuntEvent.findOne({ slug: slugArg });
    if (one) events = [one];
  } else {
    events = await CampusHuntEvent.find({
      $or: [
        { slug: /coep|campus.?hunt|mindspark|neurosprint/i },
        { name: /coep|campus.?hunt|mindspark|neurosprint/i },
        { college: /coep/i },
      ],
    }).sort({ updatedAt: -1 }).limit(10);
  }

  if (!events.length) {
    const all = await CampusHuntEvent.find({}).select('name slug college teamCapacity updatedAt').lean();
    console.log('No COEP match. All campus hunt events:');
    all.forEach((e) => console.log(`  ${e.slug} · ${e.name} · ${e.college} · ${e.teamCapacity} teams`));
    throw new Error('No matching event — pass --slug=...');
  }

  console.log('Candidates:');
  events.forEach((e) => console.log(`  ${e._id} · ${e.slug} · ${e.name} · ${e.college}`));

  const event = events[0];
  console.log('\nUpdating:', event.slug, event.name);

  const plan = normalizeRoundPlan(
    { round1Name: event.roundPlan?.round1Name || event.name || 'Campus Hunt' },
    { teamCapacity: event.teamCapacity || 20 },
  );
  const format = deriveCompetitionFormat({
    teamCapacity: event.teamCapacity || 20,
    teamSize: event.teamSize || 10,
    roundPlan: plan,
  });

  event.teamCapacity = format.teamCapacity;
  event.teamSize = format.teamSize;
  event.roundPlan = {
    round1Name: plan.round1Name,
    round2Name: '',
    round3Name: '',
    finaleName: '',
    qualifyFromRound1: 0,
    qualifyFromRound2: 0,
    qualifyFromRound3: 0,
  };
  event.finaleCapacity = 0;
  event.finaleDirectFromR1 = 0;
  event.playerRoundAccess = { round1: true, survival: false, finale: false };
  event.destinationName = DEFAULT_DESTINATION_NAME;
  event.startCount = 1;
  event.stationCount = DEFAULT_CAMPUS_STATIONS.length;
  await event.save();

  const layout = await updateCampusStations({
    eventId: event._id,
    stations: DEFAULT_CAMPUS_STATIONS,
    starts: DEFAULT_CAMPUS_STARTS.slice(0, 1),
    stationCount: DEFAULT_CAMPUS_STATIONS.length,
    startCount: 1,
    actor: { actorType: 'script', actorId: 'refresh-coep-campus-hunt' },
    reason: 'Refresh Neurosprint places + single-game leader-phone format',
  });
  console.log('Stations:', layout.stationCount, 'Starts:', layout.startCount);
  console.log('Destination:', DEFAULT_DESTINATION_NAME);

  const boot = await bootstrapRound1Defaults({
    eventId: event._id,
    actor: { actorType: 'script', actorId: 'refresh-coep-campus-hunt' },
    createTeams: true,
    enablePublicLeaderboard: true,
    challengeNumbers: null,
  });

  const challengeCount = await CampusHuntChallenge.countDocuments({ eventId: event._id });
  const checkpointCount = await CampusHuntCheckpoint.countDocuments({ eventId: event._id });
  const clueNums = await CampusHuntChallenge.distinct('challengeNumber', { eventId: event._id });

  console.log('\nBootstrap done');
  console.log('  teams:', boot.teams?.length || boot.teamCount || '—');
  console.log('  challenges:', challengeCount, 'numbers:', clueNums.sort((a, b) => a - b).join(','));
  console.log('  checkpoints:', checkpointCount);
  console.log('  round:', boot.round?.status || boot.roundStatus || '—');
  console.log('\nAdmin: /campus-hunt/admin/events/' + event._id);
  console.log('Open Clues → confirm Bootstrap all clues if UI still shows stale draft.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
