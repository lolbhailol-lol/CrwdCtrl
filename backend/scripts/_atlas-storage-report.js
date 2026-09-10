require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 30000,
  });
  const db = mongoose.connection.db;
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name);
  const rows = [];
  for (const name of names) {
    const stats = await db.command({ collStats: name, scale: 1024 * 1024 }).catch(() => ({}));
    rows.push({
      collection: name,
      count: stats.count ?? await db.collection(name).estimatedDocumentCount().catch(() => null),
      dataMB: stats.size == null ? null : Number(stats.size.toFixed(2)),
      storageMB: stats.storageSize == null ? null : Number(stats.storageSize.toFixed(2)),
      indexesMB: stats.totalIndexSize == null ? null : Number(stats.totalIndexSize.toFixed(2)),
      totalMB: stats.storageSize == null
        ? null
        : Number((stats.storageSize + (stats.totalIndexSize || 0)).toFixed(2)),
    });
  }
  rows.sort((a, b) => (b.totalMB || 0) - (a.totalMB || 0));
  console.table(rows);
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
