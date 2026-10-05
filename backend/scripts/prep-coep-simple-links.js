/**
 * Prep COEP Campus Hunt for simple Links flow:
 * prune excess → bootstrap clues/teams → ensure passwords → bind paths → public flags.
 *
 * Usage: node backend/scripts/prep-coep-simple-links.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');

registerModels();

const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
const CampusHuntChallenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const { pruneExcessTeams } = require('../src/modules/campus-hunt/services/capacityService');
const { bootstrapRound1Defaults } = require('../src/modules/campus-hunt/services/round1BootstrapService');
const { generateSchedule } = require('../src/modules/campus-hunt/services/startScheduleService');
const { provisionTeamRoster } = require('../src/modules/campus-hunt/services/rosterProvisionService');
const { isTeamPasswordReady } = require('../src/modules/campus-hunt/utils/roster');
const { selectCompetitionTeams } = require('../src/modules/campus-hunt/services/startScheduleService');
const {
  ensureEventStationPlants,
  DEFAULT_STATION_JOINED_WORDS,
} = require('../src/modules/campus-hunt/services/stationCatalogService');
const { exportOfflinePacks } = require('../src/modules/campus-hunt/services/offlineExportService');

const ACTOR = { actorType: 'script', actorId: 'prep-coep-simple-links' };
const DEFAULT_PASSWORD = 'COEP2026';

async function ensurePasswords(event) {
  const teams = await CampusHuntTeam.find({ eventId: event._id })
    .select('+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword +accessPack.leader.encryptedPassword')
    .lean();
  const field = selectCompetitionTeams(teams, event.teamCapacity);
  let updated = 0;
  for (const team of field) {
    if (isTeamPasswordReady(team)) continue;
    // eslint-disable-next-line no-await-in-loop
    const provisioned = await provisionTeamRoster({
      eventId: event._id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      leaderEmail: team.leaderContactEmail || `team.${String(team.teamCode).toLowerCase()}@campus-hunt.local`,
      leaderName: team.leaderName || `Leader ${team.teamCode}`,
      leaderPassword: DEFAULT_PASSWORD,
      memberNames: team.memberNames?.length
        ? team.memberNames
        : Array.from({ length: Math.max(1, (Number(event.teamSize) || 4) - 1) }, (_, i) => `Member ${i + 1}`),
      scannerPassword: DEFAULT_PASSWORD,
      teamSize: event.teamSize || 4,
    });
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntTeam.updateOne(
      { _id: team._id },
      {
        $set: {
          accessPack: provisioned.accessPack,
          leaderName: provisioned.leaderName || team.leaderName,
          memberNames: provisioned.memberNames || team.memberNames,
          leaderUserId: provisioned.leaderUserId || team.leaderUserId,
          memberUserIds: provisioned.memberUserIds || team.memberUserIds,
        },
      },
    );
    updated += 1;
  }
  return { field: field.length, updated, password: DEFAULT_PASSWORD };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const event = await CampusHuntEvent.findOne({
    $or: [
      { slug: 'coep-campus-hunt' },
      { college: /coep/i },
      { slug: /coep/i },
    ],
  }).sort({ updatedAt: -1 });
  if (!event) throw new Error('COEP event not found');

  console.log('Event:', event.slug, event.name, '·', event.college);
  console.log('Capacity:', event.teamCapacity, '×', event.teamSize);

  event.teamCapacity = Math.max(2, Number(event.teamCapacity) || 20);
  event.teamSize = Math.max(2, Number(event.teamSize) || 4);
  event.startCount = Math.max(1, Number(event.startCount) || 1);
  event.publicLoginLive = true;
  event.publicLeaderboardLive = true;
  event.playerRoundAccess = { round1: true, survival: false, finale: false };
  await event.save();

  const pruned = await pruneExcessTeams(event._id);
  console.log('Prune:', pruned);

  // Force COEP join-words + plant slips sized to teamSize.
  const plants = await ensureEventStationPlants(event, { force: true });
  console.log(
    'Plants:',
    plants.catalog.filter((s) => s.joinedWord).length,
    'stops with join-words ·',
    'teamSize',
    plants.teamSize,
    '· checkpoints synced',
    plants.checkpointsSynced,
  );
  console.log('Sample:', plants.catalog.slice(0, 3).map((s) => (
    `${s.code}=${s.joinedWord}[${(s.plantFragments || []).join('|')}]`
  )).join(' · '));

  const boot = await bootstrapRound1Defaults({
    eventId: event._id,
    actor: ACTOR,
    createTeams: true,
    enablePublicLeaderboard: true,
    challengeNumbers: null,
  });
  console.log('Bootstrap teams created:', boot.teams?.created ?? 0, 'skipped:', boot.teams?.skipped ?? 0);

  // Re-apply plants after bootstrap (in case catalog was reset).
  const eventFresh = await CampusHuntEvent.findById(event._id);
  const plants2 = await ensureEventStationPlants(eventFresh, { force: true });
  console.log('Plants re-applied:', plants2.catalog.filter((s) => s.joinedWord).length, 'words');

  const pwd = await ensurePasswords(eventFresh);
  console.log('Passwords:', pwd);

  const round = await CampusHuntRound.findOne({ eventId: event._id, roundNumber: 1 });
  if (round) {
    await generateSchedule({
      eventId: event._id,
      roundId: round._id,
      startsAt: round.startsAt || new Date(),
      releaseIntervalMinutes: round.releaseIntervalMinutes || 5,
      assignmentStrategy: round.assignmentStrategy || 'route_balanced',
      confirm: true,
      actor: ACTOR,
      reason: 'COEP simple links prep — bind paths',
    });
    console.log('Path bindings: generated');
  }

  const teams = await CampusHuntTeam.find({ eventId: event._id })
    .select('+accessPack.encryptedTeamPassword clue1ChallengeId clue6ChallengeId firstCheckpointId fifthCheckpointId')
    .lean();
  const field = selectCompetitionTeams(teams, event.teamCapacity);
  const passwordsReady = field.filter((t) => isTeamPasswordReady(t)).length;
  const bound = field.filter((t) => (
    t.clue1ChallengeId && t.clue6ChallengeId && t.firstCheckpointId && t.fifthCheckpointId
  )).length;
  const clueNums = await CampusHuntChallenge.distinct('challengeNumber', { eventId: event._id });
  const checkpoints = await CampusHuntCheckpoint.countDocuments({ eventId: event._id, active: { $ne: false } });
  const withJoin = await CampusHuntCheckpoint.countDocuments({
    eventId: event._id,
    joinedWord: { $exists: true, $nin: [null, ''] },
  });

  let packPreview = null;
  try {
    packPreview = await exportOfflinePacks(event._id);
  } catch (err) {
    console.warn('Offline pack preview failed:', err.message);
  }

  console.log('\nReady for Links (COEP):');
  console.log('  teams', field.length, '/', event.teamCapacity);
  console.log('  passwords', passwordsReady);
  console.log('  path-bound', bound);
  console.log('  clue numbers', clueNums.sort((a, b) => a - b).join(','));
  console.log('  checkpoints', checkpoints, '· with join-word', withJoin);
  console.log('  default join-words catalog', Object.keys(DEFAULT_STATION_JOINED_WORDS).length);
  console.log('  login/leaderboard live', event.publicLoginLive, event.publicLeaderboardLive);
  console.log('  default password (teams that needed one):', DEFAULT_PASSWORD);
  if (packPreview) {
    console.log(
      '  offline packs',
      packPreview.teamCount,
      '· warnings',
      packPreview.warnings?.length || 0,
      '· incomplete',
      packPreview.incompleteTeams?.length || 0,
    );
    if (packPreview.warnings?.length) {
      console.log('  pack warnings:', packPreview.warnings.slice(0, 8).join(' | '));
    }
  }
  console.log('\nAdmin:', `/admin/campus-hunt/${event._id}`);
  console.log('→ Clues: plant fragments filled · Links → Create leader packs');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
