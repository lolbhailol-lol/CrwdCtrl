require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const { encryptCredential } = require('../src/modules/campus-hunt/utils/credentialCipher');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const teams = await Team.find()
    .select('+accessPack.leader.password +accessPack.leader.encryptedPassword '
      + '+accessPack.scanners.password +accessPack.scanners.encryptedPassword '
      + '+accessPack.sharedScannerPassword +accessPack.encryptedSharedScannerPassword');
  let migrated = 0;
  for (const team of teams) {
    const pack = team.accessPack || {};
    if (pack.leader?.password && !pack.leader.encryptedPassword) {
      pack.leader.encryptedPassword = encryptCredential(pack.leader.password);
    }
    if (pack.leader) pack.leader.password = undefined;
    for (const scanner of pack.scanners || []) {
      if (scanner.password && !scanner.encryptedPassword) {
        scanner.encryptedPassword = encryptCredential(scanner.password);
      }
      scanner.password = undefined;
    }
    if (pack.sharedScannerPassword && !pack.encryptedSharedScannerPassword) {
      pack.encryptedSharedScannerPassword = encryptCredential(pack.sharedScannerPassword);
    }
    pack.sharedScannerPassword = undefined;
    team.markModified('accessPack');
    // eslint-disable-next-line no-await-in-loop
    await team.save();
    migrated += 1;
  }
  console.log(`Migrated ${migrated} Campus Hunt team access packs`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
