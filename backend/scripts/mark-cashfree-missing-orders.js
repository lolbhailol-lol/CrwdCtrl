/**
 * Mark Cashfree-missing MindSpark orders so dashboard collected matches Cashfree.
 * Usage: railway run node scripts/mark-cashfree-missing-orders.js
 */
if (!process.env.MONGODB_URI) require('dotenv').config({ override: false });
const mongoose = require('mongoose');
const axios = require('axios');

const FEST = '6a7f1010ed26d983b34e55c2';
const BASE = process.env.CASHFREE_ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function orderExists(orderId, clientId, secret) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await axios.get(`${BASE}/orders/${encodeURIComponent(orderId)}`, {
        headers: {
          'x-client-id': clientId,
          'x-client-secret': secret,
          'x-api-version': '2025-01-01',
        },
        timeout: 20000,
      });
      return true;
    } catch (err) {
      const status = err.response?.status || 0;
      if (status === 429) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      if (status === 404 || String(err.response?.data?.code || '').toLowerCase() === 'order_not_found') {
        return false;
      }
      throw err;
    }
  }
  return true;
}

async function run() {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const secret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('CASHFREE credentials required');

  await mongoose.connect(process.env.MONGODB_URI);
  const PaymentOrder = require('../src/model/payment_order_model');
  const CashfreeSettlement = require('../src/model/cashfree_settlement_model');
  const Competition = require('../src/model/competition_model');

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
    .select('orderId totalAmount entityType')
    .lean();

  // Only probe orders that are not already SUCCESS / PENDING / SETTLED on Cashfree.
  const successPending = await CashfreeSettlement.find({
    orderId: { $in: orders.map((o) => o.orderId) },
    status: { $in: ['SUCCESS', 'PENDING', 'SETTLED'] },
  }).select('orderId').lean();
  const okIds = new Set(successPending.map((s) => s.orderId));

  const candidates = orders.filter((o) => !okIds.has(o.orderId));
  console.log(JSON.stringify({ candidates: candidates.length }));

  let marked = 0;
  let kept = 0;
  for (const order of candidates) {
    await sleep(200);
    const exists = await orderExists(order.orderId, clientId, secret);
    if (exists) {
      kept += 1;
      continue;
    }
    await CashfreeSettlement.findOneAndUpdate(
      { orderId: order.orderId },
      {
        $set: {
          orderId: order.orderId,
          status: 'ORDER_MISSING',
          statusDescription: 'Cashfree order does not exist on the merchant account',
          cfSettlementId: null,
          transferTime: null,
          transferUtr: null,
          source: 'api',
          syncedAt: new Date(),
          raw: { orderMissing: true, markedBy: 'mark-cashfree-missing-orders' },
        },
      },
      { upsert: true, new: true },
    );
    marked += 1;
    console.log(JSON.stringify({ marked: order.orderId, amount: order.totalAmount, type: order.entityType }));
  }

  console.log(JSON.stringify({ marked, kept, unsettledCandidates: candidates.length }));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
