/**
 * Bump campushunt dry-run to 6 campus places (add S05 + S06),
 * re-bootstrap clues/QRs, resync team bindings.
 *
 * Usage: node scripts/expand-campushunt-stations.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntCheckpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
const { bootstrapRound1Defaults } = require('../src/modules/campus-hunt/services/round1BootstrapService');
const { resyncClue1TeamBindings } = require('../src/modules/campus-hunt/services/startScheduleService');
const {
  DEFAULT_CAMPUS_STATIONS,
  resolveCampusStations,
  updateCampusStations,
} = require('../src/modules/campus-hunt/services/stationCatalogService');

const SLUG = process.env.CAMPUS_HUNT_SLUG || 'campushunt';
const TARGET_COUNT = 6;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);

  const event = await CampusHuntEvent.findOne({ slug: SLUG });
  if (!event) throw new Error(`Event ${SLUG} not found`);

  // Keep existing custom names; fill missing from defaults
  const existing = Array.isArray(event.campusStations) ? event.campusStations : [];
  const byCode = new Map(
    existing.map((row) => [String(row.code || '').toUpperCase(), String(row.name || '').trim()]),
  );
  const merged = DEFAULT_CAMPUS_STATIONS.map((station) => ({
    code: station.code,
    name: byCode.get(station.code) || station.name,
  }));

  await updateCampusStations({
    eventId: event._id,
    stations: merged,
    stationCount: TARGET_COUNT,
    startCount: event.startCount,
    starts: event.campusStarts,
    actor: { actorType: 'admin', actorId: 'expand-campushunt-stations' },
    reason: 'Dry-run: expand to 6 campus places',
  });

  const refreshed = await CampusHuntEvent.findById(event._id);
  console.log(`# ${SLUG} · stationCount=${refreshed.stationCount}`);
  const active = resolveCampusStations(refreshed);
  active.forEach((s, i) => console.log(`  ${i + 1}. ${s.code} · ${s.name}`));

  console.log('# Bootstrap clues + shared QRs…');
  const boot = await bootstrapRound1Defaults({
    eventId: refreshed._id,
    createTeams: false,
    actor: { actorType: 'admin', actorId: 'expand-campushunt-stations' },
    enablePublicLeaderboard: refreshed.publicLeaderboardLive !== false,
  });

  const activeCodes = active.map((s) => s.code);
  const retired = await CampusHuntCheckpoint.updateMany(
    {
      eventId: refreshed._id,
      stationCode: { $nin: activeCodes },
      progressionKey: { $in: ['1', '2', '3', '4'] },
    },
    {
      $set: {
        active: false,
        concurrencyGuidance: 'Retired — outside active stationCount for this event.',
      },
    },
  );
  console.log(`# Retired out-of-layout checkpoints: ${retired.modifiedCount || 0}`);
  console.log(`# Clues created/updated: ${boot.cluesCreated || 0}`);

  const round = await CampusHuntRound.findOne({ eventId: refreshed._id, roundNumber: 1 });
  if (round) {
    const sync = await resyncClue1TeamBindings({
      eventId: refreshed._id,
      roundId: round._id,
      actor: { actorType: 'admin', actorId: 'expand-campushunt-stations' },
      reason: 'Rebind after expanding to 6 places',
    });
    console.log(`# Resync · updated=${sync.updated} incomplete=${sync.incomplete}`);
  }

  console.log('\nPrint orange/green/blue/purple QRs for all 6 places (ST-S01-* … ST-S06-*).');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* */ }
  process.exit(1);
});
