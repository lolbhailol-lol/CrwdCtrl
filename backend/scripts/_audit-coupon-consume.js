require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

(async () => {
  await mongoose.connect(uri);
  const paymentOrders = mongoose.connection.collection('paymentorders');

  const withCoupon = await paymentOrders.find({ couponCode: { $exists: true, $nin: [null, ''] } }).limit(5).toArray();
  console.log('Sample orders with coupon:', JSON.stringify(withCoupon.map((o) => ({
    orderId: o.orderId,
    couponCode: o.couponCode,
    couponConsumedAt: o.couponConsumedAt,
    status: o.status,
    entityType: o.entityType,
  })), null, 2));

  const paidNotConsumed = await paymentOrders.countDocuments({
    couponCode: { $exists: true, $nin: [null, ''] },
    couponConsumedAt: null,
    status: { $in: ['PAID', 'paid', 'SUCCESS', 'success', 'COMPLETED', 'completed'] },
  });

  const paidConsumed = await paymentOrders.countDocuments({
    couponCode: { $exists: true, $nin: [null, ''] },
    couponConsumedAt: { $ne: null },
  });

  const totalWithCoupon = await paymentOrders.countDocuments({
    couponCode: { $exists: true, $nin: [null, ''] },
  });

  console.log({ totalWithCoupon, paidNotConsumed, paidConsumed });

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
