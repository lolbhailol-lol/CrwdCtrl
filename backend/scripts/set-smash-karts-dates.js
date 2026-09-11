require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const r = await mongoose.connection.db.collection('event_shows').updateOne(
    { _id: new mongoose.Types.ObjectId('6a75a2fa95aa1e3cd07d316d') },
    {
      $set: {
        showTimings: [
          { date: new Date('2026-08-22T00:00:00.000Z'), time: '' },
          { date: new Date('2026-08-23T00:00:00.000Z'), time: '' },
        ],
      },
    },
  );
  console.log(JSON.stringify(r));
  const e = await mongoose.connection.db.collection('event_shows').findOne(
    { _id: new mongoose.Types.ObjectId('6a75a2fa95aa1e3cd07d316d') },
    { projection: { showTimings: 1 } },
  );
  console.log(JSON.stringify(e.showTimings, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
