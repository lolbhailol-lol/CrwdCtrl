/**
 * Ops: retarget Round 1 for 3-round ladder + one shared QR per station.
 *
 * - Patches qualification: top 5 → Finale, 35 → Survival, Finale field 12
 * - Re-runs Round 1 bootstrap (creates ST-{code}-N shared checkpoints, retires team-bound QRs)
 * - Rebinds team first/second/thirdCheckpointId from challenge variants (via schedule sync helpers)
 *
 * Usage (from backend/):
 *   node scripts/migrate-campus-hunt-shared-qr.js campushunt
 *   node scripts/migrate-campus-hunt-shared-qr.js <eventSlugOrId>
 *
 * After running: reprint Clue 1 / 2 / 3 station QR packs in admin (10 posters each).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');

registerModels();

const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const CampusHuntCheckpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const { bootstrapRound1Defaults } = require('../src/modules/campus-hunt/services/round1BootstrapService');
const {
  syncFirstCheckpointAllowLists,
  syncSecondCheckpointAllowLists,
  syncThirdCheckpointAllowLists,
} = require('../src/modules/campus-hunt/services/startScheduleService');

const QUALIFICATION = {
  topNDirectFinale: 5,
  survivalTeams: 35,
  lastChanceTeams: 0,
  finaleTeams: 12,
  nextRoundName: 'SURVIVAL_STAGE',
};

async function resolveEvent(slugOrId) {
  if (!slugOrId) return null;
  if (mongoose.Types.ObjectId.isValid(slugOrId) && String(slugOrId).length === 24) {
    const byId = await CampusHuntEvent.findById(slugOrId);
    if (byId) return byId;
  }
  return CampusHuntEvent.findOne({ slug: String(slugOrId).toLowerCase().trim() });
}

async function main() {
  const arg = process.argv[2] || 'campushunt';
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const event = await resolveEvent(arg);
  if (!event) {
    console.error(`Event not found: ${arg}`);
    process.exit(1);
  }

  console.log(`Migrating event ${event.slug} (${event._id})…`);

  const boot = await bootstrapRound1Defaults({
    eventId: event._id,
    createTeams: false,
    enablePublicLeaderboard: false,
    actor: { actorType: 'system', actorId: 'migrate-shared-qr', label: 'migrate-campus-hunt-shared-qr' },
  });

  const round = boot.round || await CampusHuntRound.findOne({ eventId: event._id, roundNumber: 1 });
  if (round) {
    round.qualification = {
      ...(round.qualification?.toObject?.() || round.qualification || {}),
      ...QUALIFICATION,
    };
    await round.save();
    console.log('Updated round qualification:', QUALIFICATION);
  }

  const teams = await CampusHuntTeam.find({ eventId: event._id })
    .select('teamCode firstCheckpointId secondCheckpointId thirdCheckpointId clue1ChallengeId clue2ChallengeId clue3ChallengeId')
    .lean();

  // Re-point team checkpoint ids from challenge variants (bootstrap already updated challenge docs)
  const CampusHuntChallenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
  let rebound = 0;
  for (const team of teams) {
    const updates = {};
    if (team.clue1ChallengeId) {
      // eslint-disable-next-line no-await-in-loop
      const c1 = await CampusHuntChallenge.findById(team.clue1ChallengeId).select('firstCheckpointId').lean();
      if (c1?.firstCheckpointId) updates.firstCheckpointId = c1.firstCheckpointId;
    }
    if (team.clue2ChallengeId) {
      // eslint-disable-next-line no-await-in-loop
      const c2 = await CampusHuntChallenge.findById(team.clue2ChallengeId).select('secondCheckpointId').lean();
      if (c2?.secondCheckpointId) updates.secondCheckpointId = c2.secondCheckpointId;
    }
    if (team.clue3ChallengeId) {
      // eslint-disable-next-line no-await-in-loop
      const c3 = await CampusHuntChallenge.findById(team.clue3ChallengeId).select('thirdCheckpointId').lean();
      if (c3?.thirdCheckpointId) updates.thirdCheckpointId = c3.thirdCheckpointId;
    }
    if (Object.keys(updates).length) {
      // eslint-disable-next-line no-await-in-loop
      await CampusHuntTeam.updateOne({ _id: team._id }, { $set: updates });
      rebound += 1;
    }
  }
  console.log(`Rebound checkpoint ids on ${rebound} teams`);

  const refreshed = await CampusHuntTeam.find({ eventId: event._id })
    .select('_id firstCheckpointId secondCheckpointId thirdCheckpointId')
    .lean();
  const assignments = refreshed.map((t) => ({
    teamId: String(t._id),
    firstCheckpointId: t.firstCheckpointId ? String(t.firstCheckpointId) : null,
    secondCheckpointId: t.secondCheckpointId ? String(t.secondCheckpointId) : null,
    thirdCheckpointId: t.thirdCheckpointId ? String(t.thirdCheckpointId) : null,
  }));

  if (round) {
    await syncFirstCheckpointAllowLists({
      eventId: event._id,
      roundId: round._id,
      assignments,
    });
    await syncSecondCheckpointAllowLists({
      eventId: event._id,
      roundId: round._id,
      assignments,
    });
    await syncThirdCheckpointAllowLists({
      eventId: event._id,
      roundId: round._id,
      assignments,
    });
    console.log('Synced station allow-lists');
  }

  const sharedActive = await CampusHuntCheckpoint.countDocuments({
    eventId: event._id,
    active: true,
    code: { $regex: /^ST-/i },
  });
  const legacyActive = await CampusHuntCheckpoint.countDocuments({
    eventId: event._id,
    active: true,
    progressionKey: { $in: ['1', '2', '3'] },
    code: { $not: /^ST-/i },
  });

  console.log(`Shared active ST- checkpoints: ${sharedActive}`);
  console.log(`Legacy team-bound still active: ${legacyActive} (should be 0)`);
  console.log('Done. Reprint Clue 1/2/3 shared QR packs in admin (10 posters each).');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
