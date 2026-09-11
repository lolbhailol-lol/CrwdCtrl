require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Lead = require('../src/model/fest_interest_lead_model');
  const fest = new mongoose.Types.ObjectId('6a6f9708884bbe0ca158dba8');

  const names = ['Prod Railway Student', 'Prod Link Student', 'Smoke Fresher', 'QR Smoke Student', 'Kiosk Smoke Lead'];
  const phones = ['9876501888', '9876501999'];

  const before = await Lead.find({
    fest,
    $or: [
      { name: { $in: names } },
      { phone: { $in: phones } },
    ],
  }).select('name phone source').lean();

  console.log('removing', before);

  const res = await Lead.deleteMany({
    fest,
    $or: [
      { name: { $in: names } },
      { phone: { $in: phones } },
    ],
  });

  console.log('deleted', res.deletedCount);

  const left = await Lead.find({ fest })
    .sort({ createdAt: -1 })
    .select('name phone source branch createdAt')
    .lean();

  console.log(
    'remaining',
    left.map((r) => ({ name: r.name, phone: r.phone, source: r.source, branch: r.branch })),
  );

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
