/**
 * Bootstrap crazy Clue 4 (prop hunt) + CP4 + Final Clue 5 for campushunt,
 * then print a plant sheet of prop codes per station.
 *
 * Usage (from backend/):
 *   node scripts/add-campushunt-crazy-clue4.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntChallenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
const { bootstrapRound1Defaults } = require('../src/modules/campus-hunt/services/round1BootstrapService');
const { resyncClue1TeamBindings } = require('../src/modules/campus-hunt/services/startScheduleService');
const { DEFAULT_SCORING_CONFIG } = require('../src/modules/campus-hunt/constants');
const { resolveCampusStations } = require('../src/modules/campus-hunt/services/stationCatalogService');

const SLUG = process.env.CAMPUS_HUNT_SLUG || 'campushunt';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);

  const event = await CampusHuntEvent.findOne({ slug: SLUG });
  if (!event) throw new Error(`Event ${SLUG} not found`);

  event.stationCount = Math.max(4, Number(event.stationCount) || 4);
  event.scoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    ...(event.scoringConfig?.toObject?.() || event.scoringConfig || {}),
    clue4: { ...DEFAULT_SCORING_CONFIG.clue4 },
    clue5: { ...DEFAULT_SCORING_CONFIG.clue5 },
  };
  event.markModified('scoringConfig');
  await event.save();

  console.log(`# ${SLUG} · stationCount=${event.stationCount} · re-bootstrap clues 1–5`);
  const result = await bootstrapRound1Defaults({
    eventId: event._id,
    createTeams: false,
    actor: { actorType: 'script', actorId: 'add-campushunt-crazy-clue4' },
  });

  const roundId = result.round?._id;
  if (roundId) {
    const sync = await resyncClue1TeamBindings({
      eventId: event._id,
      roundId,
      actor: { actorType: 'script', actorId: 'add-campushunt-crazy-clue4' },
      reason: 'Bind clue4/fourthCheckpoint after crazy clue bootstrap',
    });
    console.log(`# resync bindings · updated=${sync.updated} incomplete=${sync.incomplete}`);
  }

  const propClues = await CampusHuntChallenge.find({
    eventId: event._id,
    challengeNumber: 4,
    active: true,
  }).select('variantKey answer destinationInstruction prompt fourthCheckpointId').lean();

  const stations = resolveCampusStations(event);
  console.log('\n=== PLANT SHEET — Crazy Prop Hunt (Clue 4) ===');
  console.log('Put a silly prop at each purple FOURTH SCAN place. Sticker = CODE below.\n');
  for (const ch of propClues.sort((a, b) => String(a.variantKey).localeCompare(String(b.variantKey)))) {
    console.log(`  ${ch.variantKey || '—'}  →  CODE: ${String(ch.answer || '').toUpperCase()}`);
  }
  console.log('\nStations in layout:');
  stations.forEach((s, i) => console.log(`  ${i + 1}. ${s.code} · ${s.name}`));
  console.log('\nPrint ST-*-4 purple QR posters for each active station.');
  console.log('Final collaborative word is now Clue 5. Organizer finish after CLUE_5_*.\n');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
