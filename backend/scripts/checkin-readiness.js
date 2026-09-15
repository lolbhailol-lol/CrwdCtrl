/**
 * Pre-event check-in readiness report for a sports/run event.
 *
 * Run: node scripts/checkin-readiness.js "ice"
 *      node scripts/checkin-readiness.js "ice" --fix-qr          # generate any missing QR hashes
 *      node scripts/checkin-readiness.js "ice" --reset-checkins  # undo a dry run before the event
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const CategoryRegistration = require('../src/model/category_registration_model');

async function main() {
  const query = process.argv[2];
  const shouldFix = process.argv.includes('--fix-qr');
  const shouldReset = process.argv.includes('--reset-checkins');
  if (!query) {
    console.error(
      'Usage: node scripts/checkin-readiness.js "<event title fragment>" [--fix-qr] [--reset-checkins]',
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const events = await SportsEvent.find({ title: new RegExp(query, 'i') })
    .select('title slug eventDate city')
    .lean();

  if (!events.length) {
    console.log(`No sports event matching "${query}"`);
    await mongoose.disconnect();
    return;
  }

  for (const event of events) {
    console.log(`\n=== ${event.title} (${event.slug || 'no-slug'}) ===`);
    console.log(`date: ${event.eventDate || 'n/a'}   city: ${event.city || 'n/a'}   id: ${event._id}`);

    const regs = await CategoryRegistration.find({ category: 'sports', eventId: event._id })
      .select('status paymentStatus qrCodeData checkedIn user')
      .lean();

    const byStatus = {};
    const byPayment = {};
    let missingQr = 0;
    let checkedIn = 0;
    let noAccount = 0;
    const userIds = new Set();

    for (const r of regs) {
      byStatus[r.status || 'unset'] = (byStatus[r.status || 'unset'] || 0) + 1;
      byPayment[r.paymentStatus || 'unset'] = (byPayment[r.paymentStatus || 'unset'] || 0) + 1;
      if (r.checkedIn) checkedIn += 1;
      if (r.status === 'confirmed' && !r.qrCodeData) missingQr += 1;
      if (r.user) userIds.add(String(r.user));
      else noAccount += 1;
    }

    console.log(`total registrations: ${regs.length}`);
    console.log(`status:  ${JSON.stringify(byStatus)}`);
    console.log(`payment: ${JSON.stringify(byPayment)}`);
    console.log(`already checked in: ${checkedIn}`);
    console.log(`confirmed but NO qr hash yet: ${missingQr}`);
    console.log(`distinct user accounts: ${userIds.size}`);
    // A sports ticket only opens for the account that registered, so these people cannot
    // self-serve a QR and must be found via manual lookup at the gate.
    console.log(`registrations with NO linked account: ${noAccount}`);

    const blocked = (byStatus.pending || 0) + (byPayment.pending || 0);
    if (blocked > 0) {
      console.log(`WARNING: pending registrations cannot check in until approved.`);
    }

    if (shouldFix && missingQr > 0) {
      const targets = regs.filter((r) => r.status === 'confirmed' && !r.qrCodeData);
      for (const r of targets) {
        await CategoryRegistration.updateOne(
          { _id: r._id },
          { $set: { qrCodeData: crypto.randomBytes(16).toString('hex') } },
          { runValidators: false },
        );
      }
      console.log(`backfilled ${targets.length} qr hashes.`);
    }

    if (shouldReset && checkedIn > 0) {
      const res = await CategoryRegistration.updateMany(
        { category: 'sports', eventId: event._id, checkedIn: true },
        { $set: { checkedIn: false, checkedInAt: null } },
        { runValidators: false },
      );
      console.log(`reset ${res.modifiedCount} check-ins back to not-checked-in.`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
