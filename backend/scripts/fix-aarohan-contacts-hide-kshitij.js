/** Apply current Aarohan contacts and hide Kshitij from Explore. */
require('dotenv').config();
const mongoose = require('mongoose');
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  const fests = mongoose.connection.collection('festorganizers');
  const competitions = mongoose.connection.collection('competitions');
  const aarohan = (await fests.findOne({ slug: 'aarohan-2027' })) || (await fests.findOne({ festName: /aarohan\s*2027/i }));
  if (!aarohan) throw new Error('AAROHAN 2027 not found');
  const contact = {
    name: 'Rudransh Gupta / Niharika Choudhary',
    phone: '+91 6200465661, +91 8275155183',
    email: 'aarohan.competitions2027@gmail.com',
    instagram: 'mitaarohanfest',
  };
  const festContacts = [{
    name: 'Rudransh Gupta & Niharika Choudhary',
    role: 'Event Heads',
    phone: '+91 6200465661 (Rudransh Gupta), +91 8275155183 (Niharika Choudhary)',
    email: 'aarohan.competitions2027@gmail.com',
    instagramId: '@mitaarohanfest',
  }];
  const kshitij = await fests.findOne({ slug: 'kshitij-pune-multicity-event-2026' });
  const competitionCount = await competitions.countDocuments({ fest: aarohan._id });
  console.log(JSON.stringify({ dryRun: DRY_RUN, aarohanId: String(aarohan._id), competitionCount, kshitijId: kshitij ? String(kshitij._id) : null }, null, 2));
  if (!DRY_RUN) {
    await fests.updateOne({ _id: aarohan._id }, { $set: { contacts: festContacts } });
    await competitions.updateMany({ fest: aarohan._id }, { $set: { contact } });
    if (kshitij) await fests.updateOne({ _id: kshitij._id }, { $set: { hideFromExplore: true } });
  }
  await mongoose.disconnect();
}
main().catch((error) => { console.error(error); process.exit(1); });
