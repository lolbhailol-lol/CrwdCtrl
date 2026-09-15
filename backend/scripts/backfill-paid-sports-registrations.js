/**
 * Backfill CategoryRegistration for PAID sports PaymentOrders that never
 * completed client-side register (common when user closes UPI app after pay).
 *
 * Usage (from backend/):
 *   node scripts/backfill-paid-sports-registrations.js
 *   node scripts/backfill-paid-sports-registrations.js --apply
 *   node scripts/backfill-paid-sports-registrations.js --apply --orderId=ORDER_xxx
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PaymentOrder = require('../src/model/payment_order_model');
const CategoryRegistration = require('../src/model/category_registration_model');
const { fulfillSportsFromPaidOrder } = require('../src/services/sportsPaymentFulfillment');

const APPLY = process.argv.includes('--apply');
const orderArg = process.argv.find((a) => a.startsWith('--orderId='));
const ORDER_ID = orderArg ? orderArg.split('=')[1] : null;
const DAYS = Math.max(1, Number(process.env.BACKFILL_SPORTS_DAYS) || 14);

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const filter = {
    entityType: 'sports',
    status: 'PAID',
    'orderTags.formData': { $exists: true, $ne: null },
    updatedAt: { $gte: since },
  };
  if (ORDER_ID) filter.orderId = ORDER_ID;

  const paidOrders = await PaymentOrder.find(filter)
    .sort({ updatedAt: -1 })
    .lean();

  const missing = [];
  for (const order of paidOrders) {
    const reg = await CategoryRegistration.findOne({ payment_order_id: order.orderId }).lean();
    if (!reg) missing.push(order);
  }
  missing.sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));

  console.log(`Found ${paidOrders.length} PAID sports order(s); ${missing.length} without registration.`);
  for (const order of missing) {
    const email = order.customerEmail || order.orderTags?.formData?.email || '—';
    const name = order.orderTags?.formData?.full_name || order.orderTags?.formData?.name || '—';
    console.log(
      ` - ${order.orderId} event=${order.entityId} amount=${order.totalAmount} people=${order.people} email=${email} name=${name}`,
    );
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to create registrations.');
    await mongoose.disconnect();
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const order of missing) {
    const full = await PaymentOrder.findOne({ orderId: order.orderId });
    const result = await fulfillSportsFromPaidOrder(full);
    if (result.ok) {
      ok += 1;
      console.log(`✅ ${order.orderId} → registration ${result.registration?._id}${result.alreadyCompleted ? ' (existing)' : ''}`);
    } else {
      fail += 1;
      console.error(`❌ ${order.orderId}: ${result.error}`);
    }
  }

  console.log(`\nDone. created/existing=${ok} failed=${fail}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
