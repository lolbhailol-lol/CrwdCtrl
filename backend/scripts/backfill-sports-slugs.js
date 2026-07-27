/**
 * One-time backfill: assign unique slug to sports events missing one.
 * Run: node scripts/backfill-sports-slugs.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const { ensureUniqueSlug } = require('../src/utils/slug');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const missing = await SportsEvent.find({
    $or: [{ slug: null }, { slug: '' }, { slug: { $exists: false } }],
  }).select('_id title status slug');

  console.log(`Found ${missing.length} sports event(s) without slug`);

  let updated = 0;
  for (const event of missing) {
    const slug = await ensureUniqueSlug(SportsEvent, event.title || String(event._id), {
      excludeId: event._id,
    });
    if (!slug) {
      console.warn(`Skip ${event._id}: could not allocate slug from title "${event.title}"`);
      continue;
    }
    await SportsEvent.updateOne({ _id: event._id }, { $set: { slug } });
    updated += 1;
    console.log(`  ${event._id} → ${slug} (${event.status})`);
  }

  console.log(`Done. Updated ${updated}/${missing.length}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
