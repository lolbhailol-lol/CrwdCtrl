/**
 * Set Game of Innovation subcategory fees (one event, three student categories).
 *
 * Usage:
 *   node scripts/seed-game-of-innovation-fees.js
 *   node scripts/seed-game-of-innovation-fees.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../src/model/competition_model');
const {
  GAME_OF_INNOVATION_FEE_TIERS,
  applyFeeTiersToCompetition,
  formatCompetitionFeeTiersLabel,
} = require('../src/utils/competitionFeeTiers');

const FEST_ID = '6a7f1010ed26d983b34e55c2';
const dryRun = process.argv.includes('--dry-run');

function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const comps = await Competition.find({ fest: FEST_ID }).select('name feeAmount registrationFee feeTiers');
  const match = comps.find((c) => {
    const n = normName(c.name);
    return n === 'gameofinnovation' || n === 'gameofinnovations' || n === 'thegameofinnovations';
  });

  if (!match) {
    console.error('Game of Innovation not found under MindSpark fest', FEST_ID);
    process.exit(1);
  }

  applyFeeTiersToCompetition(match, GAME_OF_INNOVATION_FEE_TIERS);
  console.log(
    `${dryRun ? 'DRY ' : ''}UPDATE ${match.name}` +
    ` | ${formatCompetitionFeeTiersLabel(match.feeTiers)}` +
    ` | feeAmount=${match.feeAmount}`,
  );

  if (!dryRun) {
    match.markModified('feeTiers');
    await match.save();
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
