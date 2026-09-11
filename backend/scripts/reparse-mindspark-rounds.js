/**
 * Re-parse MindSpark competition rounds from stored structure text
 * into Aarohan-style round tabs (with offline/online sub-boxes where applicable).
 *
 * Usage: node scripts/reparse-mindspark-rounds.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../src/model/competition_model');
const { parseRoundsFromCompetitionDoc } = require('../src/utils/competitionRoundsParser');

const FEST_ID = '6a7f1010ed26d983b34e55c2';
const dryRun = process.argv.includes('--dry-run');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');

  await mongoose.connect(uri);
  const comps = await Competition.find({ fest: FEST_ID }).select('name rounds description').lean();

  console.log(`Found ${comps.length} MindSpark competitions${dryRun ? ' (dry run)' : ''}.`);

  let updated = 0;
  for (const comp of comps.sort((a, b) => a.name.localeCompare(b.name))) {
    const parsed = parseRoundsFromCompetitionDoc(comp);
    if (!parsed.length) {
      console.log(`  SKIP ${comp.name} — no rounds parsed`);
      continue;
    }

    const summary = parsed
      .map((r) => {
        const modes = [r.offline ? 'off' : null, r.online ? 'on' : null].filter(Boolean).join('+');
        return `${r.title}${modes ? `[${modes}]` : ''}`;
      })
      .join(' | ');

    console.log(`  ${comp.name}: ${parsed.length} round(s) — ${summary}`);

    if (!dryRun) {
      await Competition.updateOne(
        { _id: comp._id },
        { $set: { rounds: parsed } },
      );
      updated += 1;
    }
  }

  console.log(dryRun ? 'Dry run complete.' : `Updated ${updated} competitions.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
