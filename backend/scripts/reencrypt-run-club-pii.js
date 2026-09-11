/**
 * Re-encrypt run-club PII rows that were written under JWT_SECRET fallback
 * so they use the current primary key (RUN_CLUB_PII_MASTER_KEY).
 *
 * Run: node scripts/reencrypt-run-club-pii.js
 *      node scripts/reencrypt-run-club-pii.js "ice"   # one event only
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const CategoryRegistration = require('../src/model/category_registration_model');
const {
  decryptRegistrationPii,
  encryptRegistrationPii,
  deriveMasterKey,
  listMasterKeyMaterial,
  getClubDekFromMaster,
  tryDecryptPayload,
} = require('../src/utils/runClubPiiCrypto');

function needsReencrypt(reg) {
  if (!reg.piiEncrypted || !reg.responsesCipher || !reg.runClubId) return false;
  const primary = deriveMasterKey(listMasterKeyMaterial()[0]);
  const dek = getClubDekFromMaster(primary, reg.runClubId);
  const ok = tryDecryptPayload(dek, reg.responsesCipher, { json: true });
  return !(ok && typeof ok === 'object');
}

async function main() {
  const eventFilter = process.argv[2];
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  let eventIds = null;
  if (eventFilter) {
    const events = await SportsEvent.find({ title: new RegExp(eventFilter, 'i') }).select('_id title').lean();
    eventIds = events.map((e) => e._id);
    console.log(`Scope: ${events.map((e) => e.title).join(', ') || eventFilter}`);
  }

  const query = { category: 'sports', piiEncrypted: true, status: 'confirmed' };
  if (eventIds?.length) query.eventId = { $in: eventIds };

  const regs = await CategoryRegistration.find(query).lean();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const reg of regs) {
    if (!needsReencrypt(reg)) {
      skipped += 1;
      continue;
    }
    const plain = decryptRegistrationPii(reg, reg.runClubId);
    const name = plain?.responses?.full_name || plain?.responses?.name;
    if (!name) {
      failed += 1;
      console.warn(`skip ${reg._id}: could not decrypt with any configured key`);
      continue;
    }
    const encrypted = encryptRegistrationPii({
      responses: plain.responses,
      paymentScreenshotUrl: plain.paymentScreenshotUrl,
      transactionId: plain.transactionId,
      runClubId: reg.runClubId,
    });
    await CategoryRegistration.updateOne(
      { _id: reg._id },
      {
        $set: {
          responses: encrypted.responses,
          responsesCipher: encrypted.responsesCipher,
          paymentScreenshotUrl: encrypted.paymentScreenshotUrl,
          paymentScreenshotCipher: encrypted.paymentScreenshotCipher,
          transactionId: encrypted.transactionId,
          transactionIdCipher: encrypted.transactionIdCipher,
          piiSearchTokens: encrypted.piiSearchTokens,
        },
      },
      { runValidators: false },
    );
    updated += 1;
  }

  console.log(`scanned: ${regs.length}, re-encrypted: ${updated}, already current: ${skipped}, failed: ${failed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
