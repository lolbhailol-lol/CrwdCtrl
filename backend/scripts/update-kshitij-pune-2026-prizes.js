/**
 * Set Kshitij Pune Multicity cash prizes (1st place only).
 *
 * Run: node scripts/update-kshitij-pune-2026-prizes.js [--dry-run]
 */
require('dotenv').config();

const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');

const DRY = process.argv.includes('--dry-run');
const SLUG = 'kshitij-pune-multicity-event-2026';
const LEGACY_SLUG = 'kshitij-pune-regionals-2026';

const PRIZE_BY_NAME = {
  'The Boardroom Battle': '1st Place: ₹3,000/-',
  'Shuttle Showdown': '1st Place: ₹2,000/-',
  Fifa: '1st Place: ₹3,000/-',
  'Family Feud': '1st Place: ₹3,000/-',
  'Sur Taal': '1st Place: ₹2,000/-',
  'Solo Crossover': '1st Place: ₹3,000/-',
  'Bollywood Dhamaka': '1st Place: ₹6,000/-',
};

const DEFAULT_PRIZE = '1st Place: ₹2,000/-';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required');

  await mongoose.connect(uri);
  const fest = await Fest.findOne({
    $or: [
      { slug: SLUG },
      { slug: LEGACY_SLUG },
      { previousSlugs: LEGACY_SLUG },
      { festName: /^Kshitij Pune (?:Regionals|Multicity(?: Event)?)$/i },
    ],
  }).select('_id festName slug').lean();
  if (!fest) throw new Error('Kshitij fest not found');

  const comps = await Competition.find({ fest: fest._id }).select('_id name prizePool');
  const out = [];
  for (const comp of comps) {
    const prizePool = PRIZE_BY_NAME[comp.name] || DEFAULT_PRIZE;
    out.push({ name: comp.name, from: comp.prizePool || '', to: prizePool });
    if (!DRY) {
      await Competition.findByIdAndUpdate(comp._id, { $set: { prizePool } }, { runValidators: true });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: DRY,
    festId: String(fest._id),
    slug: fest.slug,
    updated: out,
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState) await mongoose.disconnect();
    });
}

module.exports = { PRIZE_BY_NAME, DEFAULT_PRIZE };
