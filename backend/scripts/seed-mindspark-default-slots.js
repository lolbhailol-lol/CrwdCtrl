/**
 * Set default slotsAllotted = 50 on MindSpark competitions that still have
 * 0 / missing capacity. Does not overwrite comps already edited (> 0).
 *
 * Uses $set updates only — never document.save() after a narrow .select(),
 * which can wipe the rest of registration (WhatsApp, form schema, etc.).
 *
 * Usage:
 *   node scripts/seed-mindspark-default-slots.js
 *   node scripts/seed-mindspark-default-slots.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../src/model/competition_model');

const FEST_ID = '6a7f1010ed26d983b34e55c2';
const DEFAULT_SLOTS = 50;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI / MONGO_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const festOid = new mongoose.Types.ObjectId(FEST_ID);

  // Read-only projection for decisions — never mutate + save these docs
  const comps = await Competition.find({ fest: festOid })
    .select('name slotsAllotted registration.settings.maxRegistrations')
    .lean();
  console.log(`MindSpark competitions: ${comps.length}`);

  let updated = 0;
  for (const c of comps) {
    const current = Number(c.slotsAllotted);
    const needsSlots = !Number.isFinite(current) || current <= 0;
    if (!needsSlots) {
      console.log(`  skip  ${c.name}: slotsAllotted=${current}`);
      continue;
    }

    console.log(`  ${dryRun ? 'would set' : 'set'}  ${c.name}: ${current || 0} → ${DEFAULT_SLOTS}`);
    if (!dryRun) {
      const $set = { slotsAllotted: DEFAULT_SLOTS };
      // Only set maxRegistrations when unset — do not clobber an existing limit
      if (c.registration?.settings?.maxRegistrations == null) {
        $set['registration.settings.maxRegistrations'] = DEFAULT_SLOTS;
      }
      await Competition.updateOne({ _id: c._id }, { $set });
    }
    updated += 1;
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'}: ${updated} / ${comps.length}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
