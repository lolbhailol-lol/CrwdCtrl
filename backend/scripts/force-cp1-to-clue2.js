/**
 * Dev cheat: mark pending checkpoint complete (requires 4 distinct members).
 *
 * Usage:
 *   node scripts/force-cp1-to-clue2.js
 *   node scripts/force-cp1-to-clue2.js CC01
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');
const { completeCheckpoint } = require('../src/modules/campus-hunt/services/checkpointService');
const { assertOnlineRosterReady } = require('../src/modules/campus-hunt/utils/roster');

registerModels();

const Event = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const Team = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const Checkpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run in production');
    process.exit(1);
  }

  const codeFilter = process.argv[2] ? String(process.argv[2]).toUpperCase() : null;
  await mongoose.connect(process.env.MONGODB_URI);
  const event = await Event.findOne({ slug: 'pilot-campus-hunt' });
  if (!event) {
    console.error('No pilot event');
    process.exit(1);
  }

  const q = { eventId: event._id };
  if (codeFilter) q.teamCode = codeFilter;
  const teams = await Team.find(q);

  for (const team of teams) {
    if (team.currentStage === 'CLUE_1_ACTIVE') {
      team.currentStage = 'CLUE_1_COMPLETED';
      await team.save();
      console.log(`${team.teamCode}: forced stage CLUE_1_COMPLETED`);
    }

    let checkpointKey = null;
    if (team.currentStage === 'CLUE_1_COMPLETED') checkpointKey = '1';
    else if (['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(team.currentStage)) {
      checkpointKey = '2';
    } else if (['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(team.currentStage)) {
      checkpointKey = '3';
    } else if (['CLUE_4_COMPLETED', 'CLUE_4_FAILED'].includes(team.currentStage)) {
      checkpointKey = 'FINISH';
    } else {
      console.log(`${team.teamCode}: skip (stage ${team.currentStage})`);
      continue;
    }

    try {
      const memberIds = assertOnlineRosterReady(team, 4);
      const checkpoint = await Checkpoint.findOne({
        eventId: event._id,
        routeId: team.routeId,
        checkpointKey,
        active: true,
      });
      if (!checkpoint) {
        console.log(`${team.teamCode}: no checkpoint ${checkpointKey}`);
        continue;
      }

      const result = await completeCheckpoint({
        team,
        checkpoint,
        volunteer: {
          actorType: 'system',
          actorId: 'force-checkpoint-script',
          label: 'force-cp-script',
        },
        source: 'manual',
        notes: 'Dev cheat: force distinct 4/4 → next stage',
        forceMemberIds: memberIds,
      });

      const fresh = await Team.findById(team._id);
      console.log(
        `${team.teamCode}: done → stage=${fresh.currentStage}`,
        result.alreadyProcessed ? '(already)' : '',
      );
    } catch (err) {
      console.log(`${team.teamCode}: FAILED — ${err.message}`);
    }
  }

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
