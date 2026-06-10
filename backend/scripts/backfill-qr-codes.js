/**
 * One-time backfill: assign qrCodeData to registrations/trek bookings missing it.
 * Run: node scripts/backfill-qr-codes.js
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Registration = require('../src/model/registration_model');
const TrekBooking = require('../src/model/trek_booking_model');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const regs = await Registration.find({
    $or: [{ qrCodeData: null }, { qrCodeData: '' }, { qrCodeData: { $exists: false } }],
  });

  let regCount = 0;
  for (const reg of regs) {
    await Registration.updateOne(
      { _id: reg._id },
      { $set: { qrCodeData: crypto.randomBytes(16).toString('hex') } },
      { runValidators: false }
    );
    regCount += 1;
  }

  const treks = await TrekBooking.find({
    $or: [{ qrCodeData: null }, { qrCodeData: '' }, { qrCodeData: { $exists: false } }],
  });

  let trekCount = 0;
  for (const booking of treks) {
    await TrekBooking.updateOne(
      { _id: booking._id },
      { $set: { qrCodeData: crypto.randomBytes(16).toString('hex') } },
      { runValidators: false }
    );
    trekCount += 1;
  }

  console.log(`Backfilled ${regCount} registrations and ${trekCount} trek bookings.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
