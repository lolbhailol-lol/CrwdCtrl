/**
 * One-shot: convert MindSpark bundle team_members string arrays → { name } objects.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const FEST_ID = '6a7f1010ed26d983b34e55c2';
const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const col = mongoose.connection.db.collection('registrations');
  const festOid = new mongoose.Types.ObjectId(FEST_ID);

  const cursor = col.find({
    fest: festOid,
    'responses.team_members.0': { $type: 'string' },
  });

  let scanned = 0;
  let updated = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;
    const raw = doc.responses?.team_members;
    if (!Array.isArray(raw)) continue;
    const next = raw
      .map((entry, index) => {
        if (typeof entry === 'string') {
          const name = entry.trim();
          return name ? { name } : null;
        }
        if (entry && typeof entry === 'object') {
          const name = String(entry.name || entry.full_name || '').trim();
          if (!name && !entry.email && !entry.phone) return null;
          return { ...entry, name: name || `Person ${index + 1}` };
        }
        return null;
      })
      .filter(Boolean);
    if (!next.length) continue;
    if (!APPLY) {
      if (updated < 5) {
        console.log('would update', String(doc._id), raw, '→', next);
      }
      updated += 1;
      continue;
    }
    await col.updateOne(
      { _id: doc._id },
      {
        $set: {
          'responses.team_members': next,
          'responses.team_size': next.length,
        },
      },
    );
    updated += 1;
  }

  console.log({ scanned, updated, apply: APPLY });
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
