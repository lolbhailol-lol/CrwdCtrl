/**
 * MindSpark — actual confirmed paid totals (no floor+growth inflation).
 * Updates mindspark.js settlementOverride to real paid numbers.
 *
 * Run: node scripts/set-mindspark-actual-paid-override.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('../src/model/usermodel');
const Registration = require('../src/model/registration_model');
const PaymentOrder = require('../src/model/payment_order_model');
const Competition = require('../src/model/competition_model');
const CashfreeSettlement = require('../src/model/cashfree_settlement_model');
const { MINDSPARK_FEST_ID } = require('../src/modules/fest/plugins/mindspark');
const {
  cashfreeBaseOrderId,
  filterCashfreeConfirmedRegs,
  summarizeCashfreeSettlement,
} = require('../src/utils/cashfreeGatewayFee');
const { isCollectedGateway } = require('../src/services/paymentSettlementMath');

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const festId = new mongoose.Types.ObjectId(MINDSPARK_FEST_ID);
  const comps = await Competition.find({ fest: festId }).select('_id').lean();
  const compIds = comps.map((c) => c._id);

  const paidRegs = await Registration.find({
    fest: festId,
    paymentStatus: 'paid',
    status: { $in: ['approved', 'pending'] },
    amountPaid: { $gt: 0 },
  }).select('amountPaid payment_gateway payment_order_id status createdAt competitionId').lean();

  const orderIds = [...new Set(paidRegs.map((r) => cashfreeBaseOrderId(r.payment_order_id)).filter(Boolean))];
  const settlements = orderIds.length
    ? await CashfreeSettlement.find({ orderId: { $in: orderIds } }).select('orderId status').lean()
    : [];

  const confirmed = filterCashfreeConfirmedRegs(paidRegs, settlements);
  const confirmedSum = summarizeCashfreeSettlement(confirmed);

  // All paid regs on collected gateways (includes ORDER_MISSING ghosts — do NOT use for lock)
  let allPaidGross = 0;
  let allPaidN = 0;
  const byGw = {};
  for (const r of paidRegs) {
    if (!isCollectedGateway(r.payment_gateway)) continue;
    const amt = Number(r.amountPaid) || 0;
    allPaidGross += amt;
    allPaidN += 1;
    const gw = String(r.payment_gateway || 'cashfree').toLowerCase() || 'cashfree';
    byGw[gw] = byGw[gw] || { n: 0, gross: 0 };
    byGw[gw].n += 1;
    byGw[gw].gross += amt;
  }

  // PAID payment orders only (MindSpark)
  const paidOrders = await PaymentOrder.find({
    status: { $in: ['PAID', 'paid'] },
    $or: [
      { entityId: festId },
      { entityType: 'fest', entityId: festId },
      { entityType: 'competition', entityId: { $in: compIds } },
      { entityType: 'competition_bundle' },
    ],
  }).select('totalAmount amount gateway entityType entityId').lean();

  let orderGross = 0;
  let orderN = 0;
  for (const po of paidOrders) {
    const et = String(po.entityType || '');
    const eid = String(po.entityId || '');
    const ok = eid === MINDSPARK_FEST_ID
      || (et === 'competition' && compIds.some((id) => String(id) === eid))
      || et === 'competition_bundle'
      || (et === 'fest' && eid === MINDSPARK_FEST_ID);
    if (!ok) continue;
    orderN += 1;
    orderGross += Number(po.totalAmount ?? po.amount) || 0;
  }

  // Growth after Cashfree lock date (approx) — approved paid regs created after lock
  const lockAt = new Date('2026-09-19T00:00:00.000Z');
  const afterLockConfirmed = confirmed.filter((r) => new Date(r.createdAt) >= lockAt);
  let afterLockGross = 0;
  for (const r of afterLockConfirmed) afterLockGross += Number(r.amountPaid) || 0;
  const afterLockFee = round2(afterLockGross * 0.016);
  const afterLockRevenue = round2(afterLockGross - afterLockFee);

  // Honest display options:
  // A) Cashfree lock only: 442381 / 435303
  // B) Actual confirmed paid now: confirmedSum
  // C) Lock + only NEW regs after lock (not live-baseline delta): 435303 + afterLockRevenue
  const optionC_gross = round2(442381 + afterLockGross);
  const optionC_revenue = round2(435303 + afterLockRevenue);

  // Use actual confirmed paid as floor+baseline (truthful; grows with new confirmed paid only)
  const grossCollected = confirmedSum.grossCollected;
  const revenue = confirmedSum.revenue;

  const pluginPath = path.join(__dirname, '..', 'src', 'modules', 'fest', 'plugins', 'mindspark.js');
  let src = fs.readFileSync(pluginPath, 'utf8');
  src = src.replace(
    /settlementOverride:\s*\{[\s\S]*?\},/,
    `settlementOverride: {
        // Actual Cashfree-confirmed + Razorpay paid only (no floor+growth inflation).
        // Old fake jump to ₹4,89,111 was floor(4,35,303) + live-delta and overstated.
        // Display = these floors; new confirmed paid above liveBaseline* adds on.
        mode: 'floor_plus_live',
        grossCollected: ${grossCollected},
        revenue: ${revenue},
        liveBaselineGross: ${grossCollected},
        liveBaselineRevenue: ${revenue},
        gatewayFeeRate: 0.016,
        additionalDeduction: 0,
    },`,
  );
  fs.writeFileSync(pluginPath, src);

  console.log(JSON.stringify({
    why489111WasWrong: {
      formula: '435303 + (liveConfirmedRevenue - oldBaseline320614)',
      thatAdded: round2(374422.48 - 320614),
      result: 489111,
      problem: 'Treated live catch-up toward Cashfree as brand-new money on top of the Cashfree floor',
    },
    actualPaid: {
      confirmedRegs: confirmed.length,
      confirmedGross: confirmedSum.grossCollected,
      confirmedFee: confirmedSum.gatewayFees,
      confirmedRevenue: confirmedSum.revenue,
      allPaidRegsCollectedGw: { n: allPaidN, gross: round2(allPaidGross) },
      byGateway: Object.fromEntries(
        Object.entries(byGw).map(([k, v]) => [k, { n: v.n, gross: round2(v.gross) }]),
      ),
      paidOrders: { n: orderN, gross: round2(orderGross) },
      afterLockConfirmedRegs: {
        n: afterLockConfirmed.length,
        gross: round2(afterLockGross),
        revenue: afterLockRevenue,
      },
    },
    optionsExplained: {
      cashfreeLockOnly: { gross: 442381, revenue: 435303 },
      actualConfirmedNow: confirmedSum,
      lockPlusNewRegsAfterSep19: { gross: optionC_gross, revenue: optionC_revenue },
    },
    appliedOverride: {
      mode: 'floor_plus_live',
      grossCollected,
      revenue,
      liveBaselineGross: grossCollected,
      liveBaselineRevenue: revenue,
      note: 'Dashboard now shows actual confirmed paid; only NEW confirmed paid increases it',
    },
  }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
