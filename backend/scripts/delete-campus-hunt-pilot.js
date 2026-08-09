/**
 * Delete the pilot Campus Hunt event and all related data.
 *
 * Usage (from backend/):
 *   node scripts/delete-campus-hunt-pilot.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');

registerModels();

const SLUG = process.env.CAMPUS_HUNT_DELETE_SLUG || 'pilot-campus-hunt';

const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
const CampusHuntRoute = require('../src/modules/campus-hunt/models/CampusHuntRoute');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const CampusHuntChallenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const CampusHuntTeamProgress = require('../src/modules/campus-hunt/models/CampusHuntTeamProgress');
const CampusHuntCheckpointVerification = require('../src/modules/campus-hunt/models/CampusHuntCheckpointVerification');
const CampusHuntIssueReport = require('../src/modules/campus-hunt/models/CampusHuntIssueReport');
const CampusHuntAuditLog = require('../src/modules/campus-hunt/models/CampusHuntAuditLog');
const CampusHuntVolunteerAccess = require('../src/modules/campus-hunt/models/CampusHuntVolunteerAccess');
const User = require('../src/model/usermodel');

async function main() {
  if (!process.argv.includes('--confirm-delete')) {
    throw new Error('Refusing deletion without --confirm-delete');
  }
  if (process.env.NODE_ENV === 'production' && process.env.CAMPUS_HUNT_ALLOW_PROD_DELETE !== 'true') {
    throw new Error('Production deletion requires CAMPUS_HUNT_ALLOW_PROD_DELETE=true');
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const event = await CampusHuntEvent.findOne({ slug: SLUG });
  if (!event) {
    console.log(`No event with slug "${SLUG}" — nothing to delete.`);
    await mongoose.disconnect();
    return;
  }

  const eventId = event._id;
  const teams = await CampusHuntTeam.find({ eventId }).select('_id').lean();
  const teamIds = teams.map((t) => t._id);
  const rosterTeams = await CampusHuntTeam.find({ eventId }).select('leaderUserId memberUserIds');
  const rosterUserIds = rosterTeams.flatMap((team) => [
    team.leaderUserId,
    ...(team.memberUserIds || []),
  ]);

  const counts = {};
  counts.teamProgress = (await CampusHuntTeamProgress.deleteMany({ teamId: { $in: teamIds } })).deletedCount;
  counts.verifications = (await CampusHuntCheckpointVerification.deleteMany({ eventId })).deletedCount;
  counts.issues = (await CampusHuntIssueReport.deleteMany({ eventId })).deletedCount;
  counts.audit = (await CampusHuntAuditLog.deleteMany({ eventId })).deletedCount;
  counts.volunteers = (await CampusHuntVolunteerAccess.deleteMany({ eventId })).deletedCount;
  counts.challenges = (await CampusHuntChallenge.deleteMany({ eventId })).deletedCount;
  counts.checkpoints = (await CampusHuntCheckpoint.deleteMany({ eventId })).deletedCount;
  counts.teams = (await CampusHuntTeam.deleteMany({ eventId })).deletedCount;
  counts.routes = (await CampusHuntRoute.deleteMany({ eventId })).deletedCount;
  counts.rounds = (await CampusHuntRound.deleteMany({ eventId })).deletedCount;
  counts.event = (await CampusHuntEvent.deleteOne({ _id: eventId })).deletedCount;
  counts.huntUsers = (await User.deleteMany({
    _id: { $in: rosterUserIds },
    email: /@hunt\.crwdctrl\.local$/i,
  })).deletedCount;

  console.log(`Deleted pilot "${event.name}" (${SLUG})`, counts);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
