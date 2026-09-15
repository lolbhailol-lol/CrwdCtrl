/**
 * One-time backfill: assign unique slug to treks missing one.
 * Also stores title-derived aliases in previousSlugs when current slug differs
 * (helps old shared title-slug links resolve after uniquify / rename era).
 *
 * Run: node scripts/backfill-trek-slugs.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Trek = require('../src/model/trek_model');
const { ensureUniqueSlug, toSlug } = require('../src/utils/slug');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const treks = await Trek.find({}).select('_id trekName status slug previousSlugs');
  console.log(`Scanning ${treks.length} trek(s)`);

  let assigned = 0;
  let aliased = 0;

  for (const trek of treks) {
    const titleSlug = toSlug(trek.trekName || '');
    const updates = {};

    if (!trek.slug) {
      const slug = await ensureUniqueSlug(Trek, trek.trekName || String(trek._id), {
        excludeId: trek._id,
      });
      if (!slug) {
        console.warn(`Skip ${trek._id}: could not allocate slug from "${trek.trekName}"`);
        continue;
      }
      updates.slug = slug;
      assigned += 1;
      console.log(`  assign ${trek._id} → ${slug} (${trek.status})`);
    }

    const currentSlug = toSlug(updates.slug || trek.slug || '');
    const prev = Array.isArray(trek.previousSlugs)
      ? trek.previousSlugs.map((s) => toSlug(s)).filter(Boolean)
      : [];
    // If title slug differs from primary (e.g. uniquified name-2), keep title slug as alias
    // so links shared before uniquify / from title-only builders still resolve.
    if (titleSlug && currentSlug && titleSlug !== currentSlug && !prev.includes(titleSlug)) {
      updates.previousSlugs = [...new Set([...prev, titleSlug])];
      aliased += 1;
      console.log(`  alias  ${trek._id}: previousSlugs += ${titleSlug}`);
    }

    if (Object.keys(updates).length) {
      await Trek.updateOne({ _id: trek._id }, { $set: updates });
    }
  }

  console.log(`Done. Assigned slug: ${assigned}. Aliases added: ${aliased}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
