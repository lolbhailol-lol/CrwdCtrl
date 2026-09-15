'use strict';

/** Cashfree gateway estimate used on the MindSpark organizer dashboard. */
const CASHFREE_GATEWAY_FEE_RATE = 0.016;

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isCashfreePayment(reg = {}) {
  if (String(reg.payment_gateway || '').trim().toLowerCase() === 'cashfree') {
    return true;
  }
  return String(reg.payment_order_id || '').trim().length > 0;
}

function cashfreeGatewayFee(amountPaid) {
  return round2((Number(amountPaid) || 0) * CASHFREE_GATEWAY_FEE_RATE);
}

function settlementForRegistration(reg = {}) {
  const amountPaid = round2(Number(reg.amountPaid) || 0);
  if (!isCashfreePayment(reg)) {
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
    cashfree: true,
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
  cashfreeGatewayFee,
  settlementForRegistration,
  cashfreeSettlementFields,
  summarizeCashfreeSettlement,
};
