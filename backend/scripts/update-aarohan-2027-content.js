/**
 * Apply AAROHAN 2027 rulebook fees, rounds, elimination rules and team sizes.
 * Usage: node scripts/update-aarohan-2027-content.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const rulebook = require('./data/aarohan-2027-rulebook.json');

const DRY_RUN = process.argv.includes('--dry-run');
const normalize = (value) => String(value || '').trim().toLowerCase();

function findEntry(name) {
  const target = normalize(name);
  return rulebook.competitions.find((entry) =>
    [entry.name, ...(entry.aliases || [])].some((candidate) => normalize(candidate) === target),
  );
}

function buildRounds(entry) {
  return entry.rounds.map((round, index) => ({
    roundNumber: index + 1,
    title: round.title,
    description: round.description || '',
    rules: round.rules || [],
    offline: { rules: round.offlineRules || [] },
    online: { rules: round.onlineRules || [] },
    roundRulesMessage: '',
    dateTime: 'To Be Announced',
    venue: 'MIT World Peace University, Pune',
  }));
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);

  const fests = mongoose.connection.collection('festorganizers');
  const competitions = mongoose.connection.collection('competitions');
  const fest =
    (await fests.findOne({ slug: 'aarohan-2027' })) ||
    (await fests.findOne({ festName: /aarohan\s*2027/i }));
  if (!fest) throw new Error('AAROHAN 2027 not found');

  const rows = await competitions.find({ fest: fest._id }).toArray();
  const updated = [];
  const ignored = [];

  for (const competition of rows) {
    const entry = findEntry(competition.name);
    if (!entry) {
      ignored.push(competition.name);
      continue;
    }

    const patch = {
      name: entry.name,
      feeAmount: entry.feeAmount,
      registrationFee: `₹${entry.feeAmount}`,
      prizePool: entry.prizePool,
      teamSizeMin: entry.teamSizeMin,
      teamSizeMax: entry.teamSizeMax,
      teamSizeLabel: entry.teamSizeLabel,
      commonRules: [],
      commonRulesMessage: '',
      rounds: buildRounds(entry),
    };

    console.log(`${DRY_RUN ? 'WOULD UPDATE' : 'UPDATE'} ${competition.name}: ₹${entry.feeAmount}, ${patch.rounds.length} round(s)`);
    if (!DRY_RUN) {
      await competitions.updateOne({ _id: competition._id }, { $set: patch });
    }
    updated.push(entry.name);
  }

  const missing = rulebook.competitions
    .map((entry) => entry.name)
    .filter((name) => !updated.includes(name));

  console.log(JSON.stringify({
    festId: String(fest._id),
    dryRun: DRY_RUN,
    updated,
    missingFromDatabase: missing,
    ignoredNotInRulebook: ignored,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
