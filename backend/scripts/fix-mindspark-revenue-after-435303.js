/**
 * MindSpark dashboard-accurate live totals (Cashfree SUCCESS/PENDING/SETTLED + Razorpay)
 * + reconcile PENDING gateway-paid orders for fest/competition/bundle.
 *
 * Usage:
 *   node scripts/fix-mindspark-revenue-after-435303.js
 *   node scripts/fix-mindspark-revenue-after-435303.js --reconcile
 *   node scripts/fix-mindspark-revenue-after-435303.js --update-override
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
const { MINDSPARK_FEST_ID, mindsparkPlugin } = require('../src/modules/fest/plugins/mindspark');
const {
  filterCashfreeConfirmedRegs,
  cashfreeBaseOrderId,
  summarizeCashfreeSettlement,
} = require('../src/utils/cashfreeGatewayFee');
const { verifyRazorpayPayment, fetchRazorpayOrder } = require('../src/services/razorpayService');
const { verifyCashfreePayment } = require('../src/services/cashfreeService');

const SHOULD_RECONCILE = process.argv.includes('--reconcile');
const UPDATE_OVERRIDE = process.argv.includes('--update-override');

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function loadProdRazorpayKeys() {
  // Prefer already-correct env; else try railway-exported temp if present
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) return;
}

async function main() {
  await loadProdRazorpayKeys();
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const festId = new mongoose.Types.ObjectId(MINDSPARK_FEST_ID);
  const comps = await Competition.find({ fest: festId }).select('_id name').lean();
  const compIds = comps.map((c) => c._id);

  const paidRegs = await Registration.find({
    fest: festId,
    paymentStatus: 'paid',
    status: { $in: ['approved', 'pending'] },
    amountPaid: { $gt: 0 },
  }).select('amountPaid payment_gateway payment_order_id status competitionId createdAt').lean();

  const orderIds = [...new Set(paidRegs.map((r) => cashfreeBaseOrderId(r.payment_order_id)).filter(Boolean))];
  const settlements = orderIds.length
    ? await CashfreeSettlement.find({ orderId: { $in: orderIds } }).select('orderId status').lean()
    : [];
  const confirmed = filterCashfreeConfirmedRegs(paidRegs, settlements);
  const live = summarizeCashfreeSettlement(confirmed);

  const o = mindsparkPlugin.settlementOverride;
  const growthGross = Math.max(0, live.grossCollected - Number(o.liveBaselineGross || 0));
  const growthRev = Math.max(0, live.revenue - Number(o.liveBaselineRevenue || 0));
  const displayGross = round2(Number(o.grossCollected) + growthGross);
  const displayRev = round2(Number(o.revenue) + growthRev);

  // Missing settlement snapshot among cashfree paid
  const missingSnap = paidRegs.filter((r) => {
    const gw = String(r.payment_gateway || '').toLowerCase();
    if (gw.includes('razorpay')) return false;
    const oid = cashfreeBaseOrderId(r.payment_order_id);
    if (!oid) return true;
    return !settlements.some((s) => s.orderId === oid);
  });

  let missingGross = 0;
  for (const r of missingSnap) missingGross += Number(r.amountPaid) || 0;

  // PENDING orders (MindSpark) last 7 days
  const pending = await PaymentOrder.find({
    status: { $in: ['PENDING', 'pending'] },
    updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    $or: [
      { entityId: festId },
      { entityType: 'fest', entityId: festId },
      { entityType: 'competition', entityId: { $in: compIds } },
      { entityType: 'competition_bundle' },
    ],
  }).sort({ updatedAt: -1 }).limit(80).lean();

  const pendingMs = pending.filter((po) => {
    const et = String(po.entityType || '');
    const eid = String(po.entityId || '');
    if (eid === MINDSPARK_FEST_ID) return true;
    if (et === 'competition' && compIds.some((id) => String(id) === eid)) return true;
    if (et === 'competition_bundle') {
      const tagFest = String(po.orderTags?.festId || po.orderTags?.fest || '');
      return !tagFest || tagFest === MINDSPARK_FEST_ID;
    }
    return false;
  });

  const reconcileResults = [];
  if (SHOULD_RECONCILE) {
    // Use prod Razorpay keys if local fails — try railway temp or existing
    let rzpOk = true;
    try {
      await fetchRazorpayOrder('order_TgZkat8OupOgJB').catch(() => null);
    } catch {
      rzpOk = false;
    }

    // Load prod keys from railway if needed
    try {
      const { execSync } = require('child_process');
      const raw = execSync('railway variables --service CrwdCtrl --json', {
        cwd: path.join(__dirname, '..', '..'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).replace(/^\uFEFF/, '');
      const vars = JSON.parse(raw);
      if (vars.RAZORPAY_KEY_ID && vars.RAZORPAY_KEY_SECRET) {
        process.env.RAZORPAY_KEY_ID = vars.RAZORPAY_KEY_ID;
        process.env.RAZORPAY_KEY_SECRET = vars.RAZORPAY_KEY_SECRET;
        delete require.cache[require.resolve('../src/services/razorpayService')];
      }
    } catch {
      /* keep local */
    }

    for (const po of pendingMs) {
      const orderId = po.orderId;
      const gateway = String(po.gateway || '').toLowerCase();
      let verify = null;
      try {
        if (gateway === 'razorpay') {
          verify = await verifyRazorpayPayment({ orderId });
        } else {
          verify = await verifyCashfreePayment({
            orderId,
            merchant: po.cashfreeMerchant === 'events' ? 'events' : 'platform',
          });
        }
      } catch (err) {
        reconcileResults.push({ orderId, error: err.message });
        continue;
      }
      if (!verify?.verified || verify.status !== 'paid') {
        reconcileResults.push({
          orderId,
          email: po.customerEmail,
          amount: po.totalAmount ?? po.amount,
          gateway,
          verifyStatus: verify?.status || 'unknown',
          code: verify?.code || null,
        });
        continue;
      }

      const updated = await PaymentOrder.findOneAndUpdate(
        { orderId, status: { $in: ['PENDING', 'pending'] } },
        {
          status: 'PAID',
          ...(verify.paymentId ? { paymentId: String(verify.paymentId) } : {}),
        },
        { new: true },
      );

      let fulfilled = false;
      let fulfillError = null;
      try {
        if (updated) {
          if (updated.entityType === 'competition_bundle') {
            const { fulfillMindSparkBundle } = require('../src/services/mindsparkBundleService');
            await fulfillMindSparkBundle(updated);
            fulfilled = true;
          } else if (['fest', 'competition'].includes(updated.entityType) && updated.orderTags?.registrationDraft) {
            const { fulfillFestCompetitionFromPaidOrder } = require('../src/services/festCompetitionPaymentFulfillment');
            await fulfillFestCompetitionFromPaidOrder(updated);
            fulfilled = true;
          }
        }
      } catch (err) {
        fulfillError = err.message;
      }

      reconcileResults.push({
        orderId,
        email: po.customerEmail,
        amount: po.totalAmount ?? po.amount,
        gateway,
        markedPaid: !!updated,
        fulfilled,
        fulfillError,
        paymentId: verify.paymentId || null,
      });
    }
  }

  // Suggested new override: lock floor to current Cashfree-confirmed live, baseline = same → growth starts clean
  const suggested = {
    mode: 'floor_plus_live',
    grossCollected: Math.max(Number(o.grossCollected) || 0, live.grossCollected),
    revenue: Math.max(Number(o.revenue) || 0, live.revenue),
    liveBaselineGross: live.grossCollected,
    liveBaselineRevenue: live.revenue,
    gatewayFeeRate: 0.016,
    additionalDeduction: 0,
  };

  // Better display interpretation: if confirmed live already exceeds old Cashfree floor comps sum,
  // dashboard should show live (not floor+inflated growth from backfills).
  const sensibleDisplay = {
    useLive: live.grossCollected >= Number(o.grossCollected),
    gross: live.grossCollected >= Number(o.grossCollected) ? live.grossCollected : displayGross,
    revenue: live.revenue >= Number(o.revenue) ? live.revenue : displayRev,
  };

  console.log(JSON.stringify({
    problem: {
      lockedFloorRevenue: o.revenue,
      lockedFloorGross: o.grossCollected,
      liveBaselineGross: o.liveBaselineGross,
      liveBaselineRevenue: o.liveBaselineRevenue,
      dashboardLiveConfirmed: live,
      growthGross,
      growthRevenue: growthRev,
      currentFloorPlusLiveDisplay: { gross: displayGross, revenue: displayRev },
      whyLooksStuck: growthGross < 1
        ? 'Live confirmed still at/below baseline → display stays at floor ₹435,303'
        : growthGross > 0
          ? 'Growth is non-zero; if UI still shows 435303, deploy/cache may be stale OR payments page uses different path'
          : '',
      paidRegsTotal: paidRegs.length,
      confirmedRegs: confirmed.length,
      excludedGhostsOrMissingSnap: paidRegs.length - confirmed.length,
      missingSettlementSnapshotCount: missingSnap.length,
      missingSettlementSnapshotGross: round2(missingGross),
    },
    sensibleDisplay,
    suggestedOverride: suggested,
    pendingMindSparkOrders: pendingMs.length,
    pendingSample: pendingMs.slice(0, 15).map((po) => ({
      orderId: po.orderId,
      amount: po.totalAmount ?? po.amount,
      gateway: po.gateway,
      entityType: po.entityType,
      email: po.customerEmail,
      updatedAt: po.updatedAt,
    })),
    reconcile: SHOULD_RECONCILE ? {
      checked: reconcileResults.length,
      markedPaid: reconcileResults.filter((r) => r.markedPaid).length,
      fulfilled: reconcileResults.filter((r) => r.fulfilled).length,
      results: reconcileResults,
    } : { skipped: true, tip: 'Re-run with --reconcile to mark gateway-paid PENDING orders' },
  }, null, 2));

  if (UPDATE_OVERRIDE) {
    const pluginPath = path.join(__dirname, '..', 'src', 'modules', 'fest', 'plugins', 'mindspark.js');
    let src = fs.readFileSync(pluginPath, 'utf8');
    src = src.replace(
      /settlementOverride:\s*\{[\s\S]*?\},/,
      `settlementOverride: {
        // Re-baselined after Cashfree clear ₹435,303 era: floor = max(old floor, live confirmed);
        // liveBaseline = current confirmed so only NEW paid growth adds on.
        mode: 'floor_plus_live',
        grossCollected: ${suggested.grossCollected},
        revenue: ${suggested.revenue},
        liveBaselineGross: ${suggested.liveBaselineGross},
        liveBaselineRevenue: ${suggested.liveBaselineRevenue},
        gatewayFeeRate: 0.016,
        additionalDeduction: 0,
    },`,
    );
    fs.writeFileSync(pluginPath, src);
    console.log(JSON.stringify({ updatedPlugin: true, suggested }, null, 2));
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
