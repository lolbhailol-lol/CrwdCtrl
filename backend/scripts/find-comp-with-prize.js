require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const c = await mongoose.connection.db.collection('competitions').findOne(
    { prizePool: { $regex: '1st', $options: 'i' } },
    { projection: { name: 1, prizePool: 1, slug: 1 } },
  );
  console.log(JSON.stringify(c, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
