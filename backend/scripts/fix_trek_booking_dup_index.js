/**
 * Resolve duplicate active trek bookings that block trek_user_active_booking_unique.
 * Keeps the newest booking per (trekId, userId); marks older ones cancelled.
 * Dry-run: node scripts/fix_trek_booking_dup_index.js
 * Apply:  node scripts/fix_trek_booking_dup_index.js --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('db', mongoose.connection.name, APPLY ? '(APPLY)' : '(dry-run)');
  const col = mongoose.connection.db.collection('trekbookings');

  const dups = await col
    .aggregate([
      {
        $match: {
          status: { $in: ['pending', 'confirmed'] },
          userId: { $type: 'objectId' },
        },
      },
      {
        $group: {
          _id: { trekId: '$trekId', userId: '$userId' },
          count: { $sum: 1 },
          docs: {
            $push: {
              id: '$_id',
              status: '$status',
              createdAt: '$createdAt',
              amount: '$bookingDetails.amountPaid',
              payment_order_id: '$payment_order_id',
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  console.log('duplicate groups:', dups.length);

  let cancelIds = [];
  for (const g of dups) {
    const sorted = [...g.docs].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });
    const keep = sorted[0];
    const drop = sorted.slice(1);
    console.log(
      `trek=${g._id.trekId} user=${g._id.userId} keep=${keep.id} cancel=${drop.length}`,
    );
    cancelIds.push(...drop.map((d) => d.id));
  }

  if (!cancelIds.length) {
    console.log('Nothing to fix.');
  } else if (!APPLY) {
    console.log(`Would cancel ${cancelIds.length} older bookings. Re-run with --apply.`);
  } else {
    const res = await col.updateMany(
      { _id: { $in: cancelIds } },
      {
        $set: {
          status: 'cancelled',
          paymentReviewNote: 'Auto-cancelled duplicate active booking (index heal)',
          updatedAt: new Date(),
        },
      },
    );
    console.log('cancelled matched=', res.matchedCount, 'modified=', res.modifiedCount);
  }

  // Guest email dups too
  const guestDups = await col
    .aggregate([
      {
        $match: {
          status: { $in: ['pending', 'confirmed'] },
          userId: null,
          userEmail: { $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: { trekId: '$trekId', userEmail: '$userEmail' },
          count: { $sum: 1 },
          docs: { $push: { id: '$_id', createdAt: '$createdAt' } },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  console.log('guest email dup groups:', guestDups.length);

  let guestCancel = [];
  for (const g of guestDups) {
    const sorted = [...g.docs].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
    guestCancel.push(...sorted.slice(1).map((d) => d.id));
  }
  if (guestCancel.length && APPLY) {
    const res = await col.updateMany(
      { _id: { $in: guestCancel } },
      {
        $set: {
          status: 'cancelled',
          paymentReviewNote: 'Auto-cancelled duplicate guest booking (index heal)',
          updatedAt: new Date(),
        },
      },
    );
    console.log('guest cancelled modified=', res.modifiedCount);
  } else if (guestCancel.length) {
    console.log(`Would cancel ${guestCancel.length} guest duplicates.`);
  }

  if (APPLY) {
    // Drop failed/incomplete unique index if present, then sync via model
    try {
      const indexes = await col.indexes();
      const names = indexes.map((i) => i.name);
      console.log('indexes before sync:', names.join(', '));
    } catch (_) { /* ignore */ }

    const TrekBooking = require('../src/model/trek_booking_model');
    await TrekBooking.syncIndexes();
    console.log('syncIndexes OK');
    console.log(
      'indexes after:',
      (await col.indexes()).map((i) => i.name).join(', '),
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
