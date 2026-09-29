/**
 * AAROHAN 2027: tidy esports prize text (same amounts) and set short descriptions.
 * Usage: node scripts/update-aarohan-2027-prizes-descriptions.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

const PRIZES = {
  BGMI: 'Winner: ₹14,000\nRunner-up: ₹8,000\nMVP: ₹5,000',
  FIFA: 'Winner: ₹4,000\nRunner-up: ₹2,000',
  'REAL CRICKET 24': 'Winner: ₹5,000\nRunner-up: ₹2,000\n2nd Runner-up: ₹1,000',
  VALORANT: 'Winner: ₹10,000\nRunner-up: ₹6,000',
};

const DESCRIPTIONS = {
  'Art Maestro': 'A solo fine arts competition for painters, sketchers and illustrators. Bring your technique, creativity and imagination to the canvas and compete for the top spot at AAROHAN 2027.',
  'Box Cricket': 'Fast, high-energy cricket in a compact box arena. Teams of 7 battle through quick-fire matches where every run and every wicket counts.',
  'Box Football': 'Quick, action-packed football on a box court. Teams of 8 go head-to-head in short, intense matches that reward pace, passing and teamwork.',
  Dastak: 'A street play competition where teams of 4–20 use voice, movement and powerful storytelling to bring social themes to life. Clear the elimination round to perform in the final.',
  Euphony: 'A solo instrumental competition open to every instrument. Take the stage and let your music speak through melody, rhythm and technique.',
  'Glamour Nova': 'A fashion show and pageant celebrating style, confidence and stage presence. Walk the ramp through the elimination round to the final, with separate male and female titles.',
  'Head Bang': 'Band wars for bands of 4–16 musicians. Clear the elimination round and battle it out live on the AAROHAN stage for the crown.',
  Humming: 'A solo singing competition for vocalists of every genre. Impress in the elimination round, then own the final stage with your voice.',
  InSync: 'A group dance competition for crews of 6–20. Bring sharp choreography, tight synchronisation and big energy from the elimination round to the grand final.',
  'Inner Flame': 'A solo dance competition open to every style. Express yourself through movement, clear the elimination round and light up the final stage.',
  Platform: 'An open mic competition for poets, storytellers, comics and spoken-word artists. One stage, one mic — make every word count.',
  'Shuttle Synergy': 'Badminton doubles with separate male and female categories. Teamwork, reflexes and smart shot placement decide who makes it through the elimination rounds.',
  'Solo Smash': 'Singles badminton with separate male and female categories. Outplay your opponents rally by rally through the elimination rounds to take the title.',
  'Velocity Table': 'Singles table tennis in a knockout format. Speed, spin and focus decide who advances round after round.',
};

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  const fests = mongoose.connection.collection('festorganizers');
  const competitions = mongoose.connection.collection('competitions');
  const fest = await fests.findOne({ slug: 'aarohan-2027' }, { projection: { _id: 1 } });
  if (!fest) throw new Error('AAROHAN 2027 not found');

  const rows = await competitions.find({ fest: fest._id }, { projection: { name: 1 } }).toArray();
  const byName = new Map(rows.map((r) => [r.name, r]));
  const missing = [...new Set([...Object.keys(PRIZES), ...Object.keys(DESCRIPTIONS)])].filter((n) => !byName.has(n));
  if (missing.length) throw new Error(`Competitions not found: ${missing.join(', ')}`);

  for (const row of rows) {
    const patch = {};
    if (PRIZES[row.name]) patch.prizePool = PRIZES[row.name];
    if (DESCRIPTIONS[row.name]) patch.description = DESCRIPTIONS[row.name];
    if (!Object.keys(patch).length) continue;
    console.log(`${DRY_RUN ? 'WOULD UPDATE' : 'UPDATE'} ${row.name}: ${Object.keys(patch).join(', ')}`);
    if (!DRY_RUN) await competitions.updateOne({ _id: row._id }, { $set: patch });
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
