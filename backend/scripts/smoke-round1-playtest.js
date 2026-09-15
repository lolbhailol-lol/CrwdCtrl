/**
 * Smoke-check Round 1 playtest path for Independence Day event (CC001).
 * Usage: node scripts/smoke-round1-playtest.js [eventId]
 */
require('dotenv').config();
const mongoose = require('mongoose');

const EVENT_ID = process.argv[2] || '6a722ada2a151369a4a2ff03';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');

  await mongoose.connect(uri);
  require('../src/modules/campus-hunt/models').registerModels();

  const { repairAllTeamRostersForEvent } = require('../src/modules/campus-hunt/services/rosterProvisionService');
  const { isTeamRosterReady } = require('../src/modules/campus-hunt/utils/roster');
  const { readTeamPassword } = require('../src/modules/campus-hunt/services/teamGateService');
  const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
  const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
  const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');

  const event = await CampusHuntEvent.findById(EVENT_ID).select('name slug');
  if (!event) throw new Error(`Event not found: ${EVENT_ID}`);

  const repair = await repairAllTeamRostersForEvent(EVENT_ID);
  const teams = await CampusHuntTeam.find({ eventId: EVENT_ID }).sort({ teamCode: 1 });
  const cc001 = teams.find((t) => t.teamCode === 'CC001');
  if (!cc001) throw new Error('CC001 not found — demo teams missing');

  const round1 = await CampusHuntRound.findOne({ eventId: EVENT_ID, roundNumber: 1 });
  const teamsReady = teams.filter((t) => t.routeId && isTeamRosterReady(t)).length;
  const startAssignmentsReady = teams.filter((t) => (
    t.startingPointId
    && t.routeId
    && t.scheduledStartAt
    && t.clue1ChallengeId
    && t.firstCheckpointId
    && t.clue2ChallengeId
    && t.secondCheckpointId
    && t.clue3ChallengeId
    && t.thirdCheckpointId
  )).length;
  const scheduleLocked = round1?.scheduleStatus === 'locked';
  const playtestStartOk = scheduleLocked && teamsReady >= 1 && startAssignmentsReady >= 1;

  const teamWithSecrets = await CampusHuntTeam.findById(cc001._id)
    .select('+accessPack.encryptedTeamPassword +accessPack.leader +accessPack.scanners');
  const hasPassword = Boolean(readTeamPassword(teamWithSecrets));

  const report = {
    event: { name: event.name, slug: event.slug },
    repair,
    cc001: {
      teamCode: cc001.teamCode,
      rosterReady: isTeamRosterReady(cc001),
      hasPassword,
      hasBindings: Boolean(cc001.firstCheckpointId && cc001.routeId),
      currentStage: cc001.currentStage,
      loginPath: `/campus-hunt/${event.slug}/team/CC001`,
    },
    readiness: {
      teamsTotal: teams.length,
      teamsReady,
      startAssignmentsReady,
      scheduleLocked,
      roundStatus: round1?.status,
      playtestStartOk,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (!isTeamRosterReady(cc001) || !hasPassword) {
    throw new Error('CC001 roster or password still incomplete after repair');
  }
  if (!playtestStartOk) {
    throw new Error('Playtest start gate not satisfied — lock schedule and ensure bindings');
  }

  console.log('\nSmoke OK: CC001 playable · playtest start gate passes');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Smoke failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
