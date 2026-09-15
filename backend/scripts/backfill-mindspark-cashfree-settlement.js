/**
 * One-time backfill: persist gatewayFee / netToOrganizer on MindSpark paid regs.
 * Does not overwrite amountPaid. Dashboard also recomputes from amountPaid.
 *
 * Run: node scripts/backfill-mindspark-cashfree-settlement.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Registration = require('../src/model/registration_model');
const { MINDSPARK_FEST_ID } = require('../src/utils/personFields');
const { cashfreeSettlementFields } = require('../src/utils/cashfreeGatewayFee');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const paid = await Registration.find({
    fest: MINDSPARK_FEST_ID,
    paymentStatus: 'paid',
  }).select('amountPaid payment_gateway payment_order_id gatewayFee netToOrganizer');

  let cashfreeCount = 0;
  let manualCount = 0;
  for (const reg of paid) {
    const fields = cashfreeSettlementFields({
      amountPaid: reg.amountPaid,
      payment_gateway: reg.payment_gateway,
      payment_order_id: reg.payment_order_id,
    });
    await Registration.updateOne(
      { _id: reg._id },
      { $set: fields },
      { runValidators: false },
    );
    if (fields.gatewayFee > 0) cashfreeCount += 1;
    else manualCount += 1;
  }

  console.log(
    `Backfilled ${paid.length} MindSpark paid registrations (${cashfreeCount} Cashfree, ${manualCount} manual/full).`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
