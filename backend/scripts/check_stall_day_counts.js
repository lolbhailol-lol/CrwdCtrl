require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Lead = require('../src/model/fest_interest_lead_model');
  const fest = new mongoose.Types.ObjectId('6a6f9708884bbe0ca158dba8');

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const day = `${get('year')}-${get('month')}-${get('day')}`;

  const istStart = new Date(`${day}T00:00:00+05:30`);
  const istEnd = new Date(istStart.getTime() + 864e5);

  const utcStart = new Date();
  utcStart.setUTCHours(0, 0, 0, 0);
  const utcEnd = new Date(utcStart);
  utcEnd.setUTCDate(utcEnd.getUTCDate() + 1);

  // Old bug: date=YYYY-MM-DD interpreted as UTC midnight on Railway
  const badStart = new Date(`${day}T00:00:00.000Z`);
  const badEnd = new Date(badStart.getTime() + 864e5);

  const count = (start, end) =>
    Lead.countDocuments({ fest, createdAt: { $gte: start, $lt: end } });

  console.log({
    day,
    istToday: await count(istStart, istEnd),
    utcToday: await count(utcStart, utcEnd),
    dateParamAsUTC: await count(badStart, badEnd),
    all: await Lead.countDocuments({ fest }),
  });

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
