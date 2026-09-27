'use strict';

/** Cashfree gateway estimate used on the MindSpark organizer dashboard. */
const CASHFREE_GATEWAY_FEE_RATE = 0.016;

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isCashfreePayment(reg = {}) {
  const gateway = String(reg.payment_gateway || '').trim().toLowerCase();
  if (gateway === 'cashfree' || gateway === 'cashfree_bundle') return true;
  // An explicit non-Cashfree gateway always wins over the legacy order-id fallback.
  if (gateway) return false;
  return String(reg.payment_order_id || '').trim().length > 0;
}

function cashfreeGatewayFee(amountPaid) {
  return round2((Number(amountPaid) || 0) * CASHFREE_GATEWAY_FEE_RATE);
}

function hasOnlineGatewayFee(reg = {}) {
  const gateway = String(reg.payment_gateway || '').trim().toLowerCase();
  if (['cashfree', 'cashfree_bundle', 'razorpay', 'razorpay_bundle'].includes(gateway)) return true;
  if (gateway) return false;
  return String(reg.payment_order_id || '').trim().length > 0;
}

function settlementForRegistration(reg = {}) {
  const amountPaid = round2(Number(reg.amountPaid) || 0);
  if (!hasOnlineGatewayFee(reg)) {
    return {
      amountPaid,
      gatewayFee: 0,
      netToOrganizer: amountPaid,
      cashfree: false,
    };
  }
  const gatewayFee = cashfreeGatewayFee(amountPaid);
  return {
    amountPaid,
    gatewayFee,
    netToOrganizer: round2(amountPaid - gatewayFee),
    cashfree: isCashfreePayment(reg),
  };
}

function cashfreeSettlementFields(reg = {}) {
  const settled = settlementForRegistration(reg);
  return {
    gatewayFee: settled.gatewayFee,
    netToOrganizer: settled.netToOrganizer,
  };
}

function summarizeCashfreeSettlement(regs = []) {
  let grossCollected = 0;
  let gatewayFees = 0;
  let revenue = 0;
  for (const reg of regs) {
    const settled = settlementForRegistration(reg);
    grossCollected += settled.amountPaid;
    gatewayFees += settled.gatewayFee;
    revenue += settled.netToOrganizer;
  }
  return {
    grossCollected: round2(grossCollected),
    gatewayFees: round2(gatewayFees),
    revenue: round2(revenue),
  };
}

/** Strip MindSpark bundle suffix (`orderId:competitionObjectId`). */
function cashfreeBaseOrderId(paymentOrderId) {
  const raw = String(paymentOrderId || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(.*?):([a-fA-F0-9]{24})$/);
  return m ? m[1] : raw;
}

/**
 * Organizer “collected” should match Cashfree merchant totals:
 * SUCCESS / PENDING / SETTLED + Razorpay / manual. Skip ORDER_MISSING and no-snapshot.
 */
function isCashfreeConfirmedRegistration(reg = {}, statusByOrderId = new Map()) {
  const gateway = String(reg.payment_gateway || '').trim().toLowerCase();
  if (gateway.includes('razorpay')) return true;
  if (gateway === 'manual_organizer' || gateway === 'organizer_qr') {
    return (Number(reg.amountPaid) || 0) > 0;
  }
  const orderId = cashfreeBaseOrderId(reg.payment_order_id);
  if (!orderId) return false;
  const status = String(statusByOrderId.get(orderId) || '').toUpperCase();
  return status === 'SUCCESS' || status === 'PENDING' || status === 'SETTLED';
}

function filterCashfreeConfirmedRegs(regs = [], settlements = []) {
  const statusByOrderId = new Map(
    (settlements || []).map((s) => [String(s.orderId), String(s.status || '').toUpperCase()]),
  );
  return (regs || []).filter((reg) => isCashfreeConfirmedRegistration(reg, statusByOrderId));
}

/**
 * Proportionally scale competition gross/revenue so they sum exactly to locked totals.
 * Remainder goes to the largest competition to avoid ₹0.01 drift.
 */
function scaleCompetitionSettlementToTotals(competitionStats = [], targets = {}) {
  const targetGross = round2(Number(targets.grossCollected) || 0);
  const targetRevenue = round2(Number(targets.revenue) || 0);
  const rows = (competitionStats || []).filter((c) => (Number(c.grossCollected) || 0) > 0
    || (Number(c.revenue) || 0) > 0);
  if (!rows.length || (targetGross <= 0 && targetRevenue <= 0)) return competitionStats;

  const sumGross = rows.reduce((s, c) => s + (Number(c.grossCollected) || 0), 0);
  const sumRevenue = rows.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
  if (sumGross <= 0 && sumRevenue <= 0) return competitionStats;

  let allocatedGross = 0;
  let allocatedRevenue = 0;
  const sorted = [...rows].sort(
    (a, b) => (Number(b.grossCollected) || 0) - (Number(a.grossCollected) || 0),
  );

  for (let i = 0; i < sorted.length; i += 1) {
    const c = sorted[i];
    const isLast = i === sorted.length - 1;
    if (isLast) {
      c.grossCollected = round2(Math.max(0, targetGross - allocatedGross));
      c.revenue = round2(Math.max(0, targetRevenue - allocatedRevenue));
    } else {
      const gShare = sumGross > 0
        ? round2((Number(c.grossCollected) || 0) * (targetGross / sumGross))
        : 0;
      const rShare = sumRevenue > 0
        ? round2((Number(c.revenue) || 0) * (targetRevenue / sumRevenue))
        : round2(gShare * (1 - CASHFREE_GATEWAY_FEE_RATE));
      c.grossCollected = gShare;
      c.revenue = rShare;
      allocatedGross = round2(allocatedGross + gShare);
      allocatedRevenue = round2(allocatedRevenue + rShare);
    }
  }
  return competitionStats;
}

/**
 * Fest total = Cashfree, never below the merchant lock, plus live Razorpay,
 * never below the known snapshot.
 */
function mindSparkLockedTotals({
  cashfreeGross = 0,
  cashfreeRevenue = 0,
  razorpayGross = 0,
  override = {},
} = {}) {
  const feeRate = Number(override.gatewayFeeRate ?? CASHFREE_GATEWAY_FEE_RATE);
  const cfLockGross = round2(Number(override.cashfreeLockGross) || 0);
  const cfLockRevenue = round2(Number(override.cashfreeLockRevenue) || 0);
  const rzBaseGross = round2(Number(override.razorpayPaidGross) || 0);
  const rzBaseRevenue = round2(Number(override.razorpayPaidRevenue) || 0);
  const cfGross = round2(Math.max(Number(cashfreeGross) || 0, cfLockGross));
  const cfRevenue = round2(Math.max(Number(cashfreeRevenue) || 0, cfLockRevenue));
  const rzGross = round2(Math.max(Number(razorpayGross) || 0, rzBaseGross));
  const rzRevenue = rzGross <= rzBaseGross + 0.009
    ? rzBaseRevenue
    : round2(rzGross * (1 - feeRate));
  const grossCollected = round2(cfGross + rzGross);
  return {
    grossCollected,
    revenue: round2(cfRevenue + rzRevenue),
    gatewayFees: round2(grossCollected * feeRate),
    razorpayPaidGross: rzGross,
    razorpayPaidRevenue: rzRevenue,
    cashfreeGross: cfGross,
    cashfreeRevenue: cfRevenue,
  };
}

/**
 * Each competition keeps the real Cashfree and Razorpay amounts paid on it,
 * including bundle splits. The fest total stays at least the Cashfree lock
 * plus live Razorpay. The gap is returned as earlier clear.
 */
function applyMindSparkCollectedTotals(competitionStats = [], settlementRegs = [], override = {}, liveRazorpayOrderGross = null) {
  const additionalDeduction = Number(override.additionalDeduction) || 0;
  const isRazorpay = (reg) => String(reg.payment_gateway || '').toLowerCase().includes('razorpay');
  const cfRegs = settlementRegs.filter((reg) => !isRazorpay(reg));
  const rzRegs = settlementRegs.filter(isRazorpay);
  const knownIds = new Set(competitionStats.filter((row) => row.id).map((row) => String(row.id)));

  const matching = (regs, competition) => regs.filter((reg) => {
    const cid = reg.competitionId ? String(reg.competitionId) : '';
    if (competition.id) return cid === String(competition.id);
    return !cid || !knownIds.has(cid);
  });

  for (const competition of competitionStats) {
    const cf = summarizeCashfreeSettlement(matching(cfRegs, competition));
    const rz = summarizeCashfreeSettlement(matching(rzRegs, competition));
    competition.grossCollected = cf.grossCollected;
    competition.revenue = cf.revenue;
    competition._rzGross = rz.grossCollected;
    competition._rzRevenue = rz.revenue;
  }

  const cfOverall = summarizeCashfreeSettlement(cfRegs);
  const rzOverall = summarizeCashfreeSettlement(rzRegs);

  for (const competition of competitionStats) {
    competition.grossCollected = round2((Number(competition.grossCollected) || 0) + (Number(competition._rzGross) || 0));
    competition.revenue = round2((Number(competition.revenue) || 0) + (Number(competition._rzRevenue) || 0));
    delete competition._rzGross;
    delete competition._rzRevenue;
  }

  const rzOrderGross = liveRazorpayOrderGross == null
    ? rzOverall.grossCollected
    : round2(Number(liveRazorpayOrderGross) || 0);
  const locked = mindSparkLockedTotals({
    cashfreeGross: cfOverall.grossCollected,
    cashfreeRevenue: cfOverall.revenue,
    razorpayGross: Math.max(rzOverall.grossCollected, rzOrderGross),
    override,
  });
  const grossCollected = locked.grossCollected;
  const revenue = locked.revenue;
  const countedGross = round2(competitionStats.reduce((sum, row) => sum + (Number(row.grossCollected) || 0), 0));
  const countedRevenue = round2(competitionStats.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0));

  return {
    grossCollected,
    gatewayFees: locked.gatewayFees,
    revenue,
    additionalDeduction,
    razorpayPaidGross: locked.razorpayPaidGross,
    razorpayPaidRevenue: locked.razorpayPaidRevenue,
    earlierClearGross: round2(Math.max(0, grossCollected - countedGross)),
    earlierClearRevenue: round2(Math.max(0, revenue - countedRevenue)),
  };
}

module.exports = {
  CASHFREE_GATEWAY_FEE_RATE,
  round2,
  isCashfreePayment,
  hasOnlineGatewayFee,
  cashfreeGatewayFee,
  settlementForRegistration,
  cashfreeSettlementFields,
  summarizeCashfreeSettlement,
  cashfreeBaseOrderId,
  isCashfreeConfirmedRegistration,
  filterCashfreeConfirmedRegs,
  scaleCompetitionSettlementToTotals,
  applyMindSparkCollectedTotals,
  mindSparkLockedTotals,
};
