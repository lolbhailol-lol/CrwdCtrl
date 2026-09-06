/**
 * Unify shared gate password for all teams on an event.
 * Usage: node scripts/sync-campus-hunt-team-passwords.js [eventSlug] [password]
 * Default: campushunt / HUNT2026
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const { setTeamSharedPassword } = require('../src/modules/campus-hunt/services/teamGateService');

async function main() {
  const slug = String(process.argv[2] || 'campushunt').trim();
  const password = String(process.argv[3] || 'HUNT2026').trim();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const event = await CampusHuntEvent.findOne({ slug });
  if (!event) {
    console.error(`Event not found for slug: ${slug}`);
    process.exit(1);
  }
  const teams = await CampusHuntTeam.find({ eventId: event._id })
    .select('+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
      + '+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword')
    .sort({ teamCode: 1 });
  console.log(`Event ${slug} (${event._id}) · ${teams.length} teams · password="${password}"`);
  let ok = 0;
  for (const team of teams) {
    await setTeamSharedPassword(team, password);
    ok += 1;
    console.log(`  ✓ ${team.teamCode}`);
  }
  console.log(`Done · synced ${ok}/${teams.length}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
