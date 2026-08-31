require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
const FEST = '6a7f1010ed26d983b34e55c2';

(async () => {
  await mongoose.connect(uri);
  const coupons = mongoose.connection.collection('coupons');
  const couponUsages = mongoose.connection.collection('couponusages');
  const registrations = mongoose.connection.collection('registrations');
  const paymentOrders = mongoose.connection.collection('paymentorders');

  const festOid = new mongoose.Types.ObjectId(FEST);
  const festCoupons = await coupons.find({ festId: festOid }).toArray();

  console.log(`MindSpark coupons: ${festCoupons.length}\n`);

  for (const c of festCoupons) {
    const code = c.code;
    const usageRows = await couponUsages.find({ couponId: c._id }).toArray();
    const usageUserSum = usageRows.reduce((s, r) => s + (Number(r.usedCount) || 0), 0);
    const usageUsers = usageRows.length;

    const paidRegs = await registrations.countDocuments({
      fest: festOid,
      paymentStatus: 'paid',
      $or: [
        { couponCode: code },
        { 'responses.couponCode': code },
        { 'responses.coupon_code': code },
      ],
    });

    const orders = await paymentOrders.countDocuments({
      couponCode: code,
      status: { $in: ['PAID', 'paid', 'SUCCESS', 'success'] },
    });

    const ordersWithCoupon = await paymentOrders.countDocuments({ couponCode: code });

    console.log(JSON.stringify({
      code,
      active: c.active,
      usedCountOnCoupon: c.usedCount || 0,
      maxTotalUses: c.maxTotalUses || 0,
      usageUsersDistinct: usageUsers,
      usageSumFromCouponUsage: usageUserSum,
      paidRegsWithCode: paidRegs,
      paidOrdersWithCode: orders,
      allOrdersWithCode: ordersWithCoupon,
      mismatch: (c.usedCount || 0) !== usageUserSum ? 'usedCount vs usage sum' : null,
    }, null, 2));
    console.log('---');
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
