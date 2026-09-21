/**
 * Trim leftover teams for an event (beyond teamCapacity).
 * Usage: node backend/scripts/prune-campus-hunt-excess-teams.js [--slug=campushunt]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { registerModels } = require('../src/modules/campus-hunt/models');
const { pruneExcessTeams } = require('../src/modules/campus-hunt/services/capacityService');

registerModels();

const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const slug = argValue('--slug');
  const query = slug
    ? { slug }
    : { status: { $nin: ['draft'] } };
  const events = await CampusHuntEvent.find(query).select('name slug college teamCapacity');
  for (const ev of events) {
    const result = await pruneExcessTeams(ev._id);
    console.log(
      `${ev.slug} · ${ev.college} · capacity ${ev.teamCapacity}`
      + ` → kept ${result.kept}, removed ${result.removed}`
      + (result.removedCodes.length ? ` (${result.removedCodes.slice(0, 8).join(', ')}${result.removedCodes.length > 8 ? '…' : ''})` : ''),
    );
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
