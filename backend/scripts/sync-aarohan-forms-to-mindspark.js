/**
 * Make every AAROHAN 2027 competition use the MindSpark roster form schema.
 * Usage: node scripts/sync-aarohan-forms-to-mindspark.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { DEFAULT_PERSON_FIELDS } = require('../src/utils/personFields');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  const fests = mongoose.connection.collection('festorganizers');
  const competitions = mongoose.connection.collection('competitions');
  const fest = (await fests.findOne({ slug: 'aarohan-2027' })) || (await fests.findOne({ festName: /aarohan\s*2027/i }));
  if (!fest) throw new Error('AAROHAN 2027 not found');

  const rows = await competitions.find({ fest: fest._id }).sort({ name: 1 }).toArray();
  for (const competition of rows) {
    const patch = {
      registrationType: 'custom',
      'registration.mode': 'internal_form',
      'registration.formType': 'SINGLE_STEP',
      'registration.formSchema': [],
      'registration.steps': [],
      'registration.personFields': DEFAULT_PERSON_FIELDS,
    };
    console.log((DRY_RUN ? 'WOULD UPDATE ' : 'UPDATE ') + competition.name + ': ' + DEFAULT_PERSON_FIELDS.length + ' MindSpark participant fields, team ' + competition.teamSizeMin + '-' + competition.teamSizeMax);
    if (!DRY_RUN) await competitions.updateOne({ _id: competition._id }, { $set: patch });
  }

  console.log(JSON.stringify({ festId: String(fest._id), dryRun: DRY_RUN, competitions: rows.length }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
