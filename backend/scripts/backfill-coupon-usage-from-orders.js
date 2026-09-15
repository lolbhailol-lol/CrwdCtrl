/**
 * Backfill coupon.usedCount + CouponUsage from PAID PaymentOrders that had coupons
 * but were never marked consumed (e.g. fest competition webhook bug).
 *
 * Usage: node scripts/backfill-coupon-usage-from-orders.js [--dry-run] [--fest-id=...]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Coupon = require('../src/model/coupon_model');
const CouponUsage = require('../src/model/coupon_usage_model');
const PaymentOrder = require('../src/model/payment_order_model');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const festArg = args.find((a) => a.startsWith('--fest-id='));
const festFilter = festArg ? festArg.split('=')[1] : null;

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  await mongoose.connect(uri);

  const couponQuery = festFilter ? { festId: festFilter } : {};
  const coupons = await Coupon.find(couponQuery).lean();
  let ordersFixed = 0;
  let couponsUpdated = 0;

  for (const coupon of coupons) {
    const code = coupon.code;
    const paidOrders = await PaymentOrder.find({
      couponCode: code,
      status: 'PAID',
      userId: { $ne: null },
    }).select('orderId userId couponConsumedAt').lean();

    if (!paidOrders.length) continue;

    const usageByUser = new Map();
    for (const order of paidOrders) {
      const uid = String(order.userId);
      usageByUser.set(uid, (usageByUser.get(uid) || 0) + 1);
    }
    const totalUses = paidOrders.length;
    const distinctUsers = usageByUser.size;

    const unconsumed = paidOrders.filter((o) => !o.couponConsumedAt);
    console.log(`${code}: paid=${totalUses}, users=${distinctUsers}, unconsumed=${unconsumed.length}, was usedCount=${coupon.usedCount || 0}`);

    if (dryRun) continue;

    if (unconsumed.length) {
      await PaymentOrder.updateMany(
        { orderId: { $in: unconsumed.map((o) => o.orderId) } },
        { $set: { couponConsumedAt: new Date() } },
      );
      ordersFixed += unconsumed.length;
    }

    for (const [userId, count] of usageByUser.entries()) {
      await CouponUsage.findOneAndUpdate(
        { couponId: coupon._id, userId },
        {
          $set: {
            usedCount: count,
            lastUsedAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    await Coupon.updateOne({ _id: coupon._id }, { $set: { usedCount: totalUses } });
    couponsUpdated += 1;
  }

  console.log(JSON.stringify({ dryRun, couponsUpdated, ordersFixed }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
