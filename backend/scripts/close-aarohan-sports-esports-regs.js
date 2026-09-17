/**
 * Close Aarohan Sports + Esports registrations (show "not open yet").
 * Usage: node scripts/close-aarohan-sports-esports-regs.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DRY = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const fest =
    (await mongoose.connection.collection('festorganizers').findOne({ slug: 'aarohan-2027' })) ||
    (await mongoose.connection.collection('festorganizers').findOne({ festName: /aarohan\s*2027/i }));
  if (!fest) throw new Error('AAROHAN 2027 not found');

  const comps = mongoose.connection.collection('competitions');
  const filter = {
    fest: fest._id,
    $or: [
      { competitionType: { $in: ['sports', 'esports'] } },
      { category: { $in: ['Sports', 'Esports', 'sports', 'esports'] } },
    ],
  };

  const rows = await comps
    .find(filter)
    .project({ name: 1, competitionType: 1, category: 1, 'registration.status': 1, registrationsOpen: 1 })
    .toArray();

  console.log(
    'targets',
    rows.map((r) => ({
      name: r.name,
      type: r.competitionType,
      cat: r.category,
      status: r.registration?.status,
      open: r.registrationsOpen,
    })),
  );

  if (!DRY && rows.length) {
    const res = await comps.updateMany(
      { _id: { $in: rows.map((r) => r._id) } },
      {
        $set: {
          'registration.status': 'not_started',
          registrationsOpen: false,
        },
      },
    );
    console.log('modified', res.modifiedCount);
  } else {
    console.log(`dryRun=${DRY} count=${rows.length}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
