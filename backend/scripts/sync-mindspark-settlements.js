/**
 * Sync settlements for MindSpark NOT_FOUND / missing snapshot orders (prod Cashfree).
 * Usage: railway run node scripts/sync-mindspark-settlements.js
 */
if (!process.env.MONGODB_URI) require('dotenv').config({ override: false });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const PaymentOrder = require('../src/model/payment_order_model');
  const CashfreeSettlement = require('../src/model/cashfree_settlement_model');
  const Competition = require('../src/model/competition_model');
  const { syncSettlements } = require('../src/services/cashfreeSettlementSync');

  const FEST = '6a7f1010ed26d983b34e55c2';
  const festId = new mongoose.Types.ObjectId(FEST);
  const comps = await Competition.find({ fest: festId }).select('_id').lean();
  const compIds = comps.map((c) => c._id);

  const orders = await PaymentOrder.find({
    status: 'PAID',
    $or: [
      { entityType: 'competition_bundle', 'orderTags.festId': FEST },
      {
        entityType: { $in: ['competition', 'competition_bundle'] },
        $or: [
          { 'orderTags.festId': FEST },
          { entityId: { $in: compIds } },
        ],
      },
    ],
  })
    .select('orderId')
    .lean();

  const ids = orders.map((o) => o.orderId);
  const settled = await CashfreeSettlement.find({
    orderId: { $in: ids },
    status: { $in: ['SUCCESS', 'SETTLED', 'ORDER_MISSING'] },
  })
    .select('orderId')
    .lean();
  const done = new Set(settled.map((s) => s.orderId));
  const pending = ids.filter((id) => !done.has(id));

  console.log(JSON.stringify({ total: ids.length, toSync: pending.length }));
  const result = await syncSettlements({
    orderIds: pending,
    limit: pending.length,
    actor: 'sync-mindspark-settlements',
  });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
