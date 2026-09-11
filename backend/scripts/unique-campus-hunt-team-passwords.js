/**
 * Per-team unique passwords so Team A cannot open Team B's URL with a shared password.
 * Usage: node scripts/unique-campus-hunt-team-passwords.js [eventSlug]
 * Prints a TSV of teamCode + password for organizers.
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const { setTeamSharedPassword } = require('../src/modules/campus-hunt/services/teamGateService');

function makePassword(teamCode) {
  const suffix = crypto.randomBytes(3).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return `${String(teamCode).toUpperCase()}-${suffix || 'X7K2'}`;
}

async function main() {
  const slug = String(process.argv[2] || 'campushunt').trim();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const event = await CampusHuntEvent.findOne({ slug });
  if (!event) {
    console.error(`Event not found: ${slug}`);
    process.exit(1);
  }
  const teams = await CampusHuntTeam.find({ eventId: event._id })
    .select('+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
      + '+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword')
    .sort({ teamCode: 1 });

  console.log(`# Unique passwords for ${slug} (${teams.length} teams)`);
  console.log('teamCode\tpassword\tloginPath');
  for (const team of teams) {
    const password = makePassword(team.teamCode);
    await setTeamSharedPassword(team, password);
    console.log(`${team.teamCode}\t${password}\t/campus-hunt/${slug}/team/${team.teamCode}`);
  }
  console.log(`# Done · ${teams.length} unique passwords`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
