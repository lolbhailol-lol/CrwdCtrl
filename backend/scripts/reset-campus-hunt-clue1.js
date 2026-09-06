/**
 * Reset all pilot teams back to Clue 1 (typing) so camera/scan is hidden again.
 *
 * Usage: node scripts/reset-campus-hunt-clue1.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');

registerModels();

const Event = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const Team = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const Progress = require('../src/modules/campus-hunt/models/CampusHuntTeamProgress');
const Verification = require('../src/modules/campus-hunt/models/CampusHuntCheckpointVerification');

async function main() {
  if (!process.argv.includes('--confirm-reset')) {
    throw new Error('Refusing reset without --confirm-reset');
  }
  if (process.env.NODE_ENV === 'production' && process.env.CAMPUS_HUNT_ALLOW_PROD_RESET !== 'true') {
    throw new Error('Production reset requires CAMPUS_HUNT_ALLOW_PROD_RESET=true');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const event = await Event.findOne({ slug: 'pilot-campus-hunt' });
  if (!event) {
    console.error('No pilot event');
    process.exit(1);
  }

  const teams = await Team.find({ eventId: event._id });
  for (const team of teams) {
    team.currentStage = 'CLUE_1_ACTIVE';
    team.currentScore = event.startingScore ?? 100;
    team.status = 'active';
    team.finalScore = undefined;
    await team.save();
  }

  await Progress.deleteMany({ eventId: event._id });
  await Verification.deleteMany({ eventId: event._id });

  console.log(`Reset ${teams.length} team(s) to CLUE_1_ACTIVE`);
  console.log('Deleted challenge progress + checkpoint verifications for pilot event');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
