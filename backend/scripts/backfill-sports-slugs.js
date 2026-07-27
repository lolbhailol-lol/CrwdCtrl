/**
 * One-time backfill: assign unique slug to sports events missing one.
 * Also stores title-derived aliases in previousSlugs when current slug differs.
 *
 * Run: node scripts/backfill-sports-slugs.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const { ensureUniqueSlug, toSlug } = require('../src/utils/slug');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const events = await SportsEvent.find({}).select('_id title status slug previousSlugs');
  console.log(`Scanning ${events.length} sports event(s)`);

  let assigned = 0;
  let aliased = 0;

  for (const event of events) {
    const titleSlug = toSlug(event.title || '');
    const updates = {};

    if (!event.slug) {
      const slug = await ensureUniqueSlug(SportsEvent, event.title || String(event._id), {
        excludeId: event._id,
      });
      if (!slug) {
        console.warn(`Skip ${event._id}: could not allocate slug from title "${event.title}"`);
        continue;
      }
      updates.slug = slug;
      assigned += 1;
      console.log(`  assign ${event._id} → ${slug} (${event.status})`);
    }

    const currentSlug = toSlug(updates.slug || event.slug || '');
    const prev = Array.isArray(event.previousSlugs)
      ? event.previousSlugs.map((s) => toSlug(s)).filter(Boolean)
      : [];
    if (titleSlug && currentSlug && titleSlug !== currentSlug && !prev.includes(titleSlug)) {
      updates.previousSlugs = [...new Set([...prev, titleSlug])];
      aliased += 1;
      console.log(`  alias  ${event._id}: previousSlugs += ${titleSlug}`);
    }

    if (Object.keys(updates).length) {
      await SportsEvent.updateOne({ _id: event._id }, { $set: updates });
    }
  }

  console.log(`Done. Assigned slug: ${assigned}. Aliases added: ${aliased}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
