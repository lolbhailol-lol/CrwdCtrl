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

module.exports = {
  CASHFREE_GATEWAY_FEE_RATE,
  round2,
  isCashfreePayment,
  hasOnlineGatewayFee,
  cashfreeGatewayFee,
  settlementForRegistration,
  cashfreeSettlementFields,
  summarizeCashfreeSettlement,
};
