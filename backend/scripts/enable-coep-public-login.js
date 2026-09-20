/**
 * Enable public login + leaderboard for COEP campus hunt.
 * Usage: node backend/scripts/enable-coep-public-login.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('campushuntevents');
  const result = await col.updateOne(
    { slug: 'coep-campus-hunt' },
    { $set: { publicLoginLive: true, publicLeaderboardLive: true } },
  );
  const doc = await col.findOne(
    { slug: 'coep-campus-hunt' },
    { projection: { name: 1, college: 1, slug: 1, publicLoginLive: 1, publicLeaderboardLive: 1, status: 1 } },
  );
  console.log('update:', result.matchedCount, result.modifiedCount);
  console.log(doc);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
