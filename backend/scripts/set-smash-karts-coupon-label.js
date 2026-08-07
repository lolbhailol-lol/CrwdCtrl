require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const r = await mongoose.connection.db.collection('event_shows').updateOne(
    { _id: new mongoose.Types.ObjectId('6a75a2fa95aa1e3cd07d316d') },
    {
      $set: {
        priceLabel: '₹120 · Coupon CTRL20 · 20% OFF',
        registrationProcess: 'Use coupon CTRL20 at checkout for 20% OFF',
        description:
          'Online Smash Karts tournament. Entry ₹120 · Coupon CTRL20 = 20% OFF · 100 slots · Prize pool ₹9,000+. Join Discord: https://discord.gg/uk5AjcGEF',
      },
    },
  );
  console.log(JSON.stringify(r));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
