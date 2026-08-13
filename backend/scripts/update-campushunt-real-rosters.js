/**
 * Apply real 8-team / 3-person rosters for campushunt (leader + 2 scanners).
 * Usage: node scripts/update-campushunt-real-rosters.js [eventSlug]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const { provisionTeamRoster } = require('../src/modules/campus-hunt/services/rosterProvisionService');
const {
  readTeamPassword,
  setTeamSharedPassword,
} = require('../src/modules/campus-hunt/services/teamGateService');

const ROSTERS = [
  { teamCode: 'CC001', teamName: 'Enigma', leaderName: 'Tejas', memberNames: ['Kartik', 'Mayank'] },
  { teamCode: 'CC002', teamName: 'Phoenix', leaderName: 'Khushi', memberNames: ['Shalini', 'Yashasvi'] },
  { teamCode: 'CC003', teamName: 'Eclipse', leaderName: 'Shreyash', memberNames: ['Amaan', 'Niharika'] },
  { teamCode: 'CC004', teamName: 'Wolves', leaderName: 'Nabhya', memberNames: ['Ananaya', 'Aryan'] },
  { teamCode: 'CC005', teamName: 'Nova', leaderName: 'Nevya', memberNames: ['Khushboo', 'Harshal'] },
  { teamCode: 'CC006', teamName: 'Cyclone', leaderName: 'Krisha', memberNames: ['Neeti', 'Avani'] },
  { teamCode: 'CC007', teamName: 'Titans', leaderName: 'Ridhima', memberNames: ['Riya', 'Diya'] },
  { teamCode: 'CC008', teamName: 'Inferno', leaderName: 'Mohit', memberNames: ['Ayushi', 'Molika'] },
];

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

  event.teamCapacity = 8;
  event.teamSize = 3;
  await event.save();

  console.log(`# Updating ${slug} → capacity 8 · teamSize 3`);
  console.log('teamCode\tteamName\tleader\tmembers\tpasswordKept');

  for (const row of ROSTERS) {
    // eslint-disable-next-line no-await-in-loop
    const team = await CampusHuntTeam.findOne({ eventId: event._id, teamCode: row.teamCode })
      .select('+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
        + '+accessPack.leader.encryptedPassword');
    if (!team) {
      console.error(`Missing team ${row.teamCode}`);
      // eslint-disable-next-line no-continue
      continue;
    }

    const existingPassword = readTeamPassword(team) || 'HUNT2026';

    // eslint-disable-next-line no-await-in-loop
    const provisioned = await provisionTeamRoster({
      eventId: event._id,
      teamCode: team.teamCode,
      teamName: row.teamName,
      leaderEmail: team.leaderContactEmail || team.accessPack?.leader?.contactEmail || '',
      leaderName: row.leaderName,
      leaderPassword: existingPassword,
      memberNames: row.memberNames,
      scannerPassword: existingPassword,
      teamSize: 3,
    });

    team.teamName = row.teamName;
    team.leaderName = provisioned.leaderName;
    team.memberNames = provisioned.memberNames;
    team.leaderUserId = provisioned.leaderUserId;
    team.memberUserIds = provisioned.memberUserIds;
    team.leaderContactEmail = provisioned.leaderContactEmail || team.leaderContactEmail;
    team.accessPack = provisioned.accessPack;
    // eslint-disable-next-line no-await-in-loop
    await team.save();
    // eslint-disable-next-line no-await-in-loop
    await setTeamSharedPassword(team, existingPassword);

    console.log(
      `${row.teamCode}\t${row.teamName}\t${row.leaderName}\t${row.memberNames.join(', ')}\t${existingPassword}`,
    );
  }

  console.log('# Done · refresh Team Manager / team login pages');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
