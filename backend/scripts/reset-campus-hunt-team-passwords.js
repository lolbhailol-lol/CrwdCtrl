/**
 * Re-set Campus Hunt team password vaults when ciphertext can't be decrypted
 * (JWT / credential key rotation).
 *
 * Usage:
 *   node scripts/reset-campus-hunt-team-passwords.js
 *   node scripts/reset-campus-hunt-team-passwords.js 6a776d65500265387d6b8a86 hunt2026
 *   node scripts/reset-campus-hunt-team-passwords.js 6a776d65500265387d6b8a86 --only-broken
 */
require('dotenv').config();
const mongoose = require('mongoose');

const eventIdArg = process.argv[2] || '6a776d65500265387d6b8a86';
const args = process.argv.slice(3);
const onlyBroken = args.includes('--only-broken');
const passwordArg = args.find((a) => a && !a.startsWith('--')) || 'hunt2026';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');

  if (!String(process.env.CAMPUS_HUNT_CREDENTIAL_KEY || '').trim()) {
    console.warn(
      'WARNING: CAMPUS_HUNT_CREDENTIAL_KEY is empty — encrypting with JWT_SECRET. '
      + 'Set CAMPUS_HUNT_CREDENTIAL_KEY in .env to avoid this breaking again.',
    );
  }

  await mongoose.connect(uri);
  require('../src/modules/campus-hunt/models').registerModels();

  const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
  const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
  const {
    setTeamSharedPassword,
    isCredentialVaultUnreadable,
    readTeamPassword,
  } = require('../src/modules/campus-hunt/services/teamGateService');

  const eventId = new mongoose.Types.ObjectId(eventIdArg);
  const event = await CampusHuntEvent.findById(eventId).select('name slug');
  if (!event) throw new Error(`Event not found: ${eventIdArg}`);

  const password = String(passwordArg || '').trim();
  if (password.length < 4) throw new Error('Password must be at least 4 characters');

  const teams = await CampusHuntTeam.find({ eventId })
    .select(
      'teamCode teamName leaderUserId memberUserIds '
      + '+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
      + '+accessPack.sharedScannerPassword +accessPack.leader +accessPack.scanners',
    )
    .sort({ teamCode: 1 });

  let updated = 0;
  let skipped = 0;
  const codes = [];

  for (const team of teams) {
    const broken = isCredentialVaultUnreadable(team);
    const readable = Boolean(readTeamPassword(team));
    if (onlyBroken && !broken && readable) {
      skipped += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await setTeamSharedPassword(team, password);
    updated += 1;
    codes.push(team.teamCode);
  }

  console.log('Team password vaults reset');
  console.log({
    eventId: String(eventId),
    eventName: event.name,
    slug: event.slug,
    password,
    updated,
    skipped,
    sampleTeams: codes.slice(0, 5),
  });
  console.log(`\nAll updated teams now use password: ${password}`);
  console.log('Login: /campus-hunt/' + event.slug + '/team/CC001 (etc.)');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Reset failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
