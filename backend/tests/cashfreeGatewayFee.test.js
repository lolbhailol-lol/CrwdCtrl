const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CASHFREE_GATEWAY_FEE_RATE,
  cashfreeGatewayFee,
  isCashfreePayment,
  settlementForRegistration,
  cashfreeSettlementFields,
  summarizeCashfreeSettlement,
} = require('../src/utils/cashfreeGatewayFee');

test('Cashfree gateway rate is 1.6 percent', () => {
  assert.equal(CASHFREE_GATEWAY_FEE_RATE, 0.016);
});

test('gateway fee rounds to 2 decimals for MindSpark ticket prices', () => {
  assert.equal(cashfreeGatewayFee(99), 1.58);
  assert.equal(cashfreeGatewayFee(150), 2.4);
  assert.equal(cashfreeGatewayFee(199), 3.18);
  assert.equal(cashfreeGatewayFee(300), 4.8);
  assert.equal(cashfreeGatewayFee(500), 8);
});

test('₹199 Cashfree entry nets ₹195.82 to the organizer', () => {
  const settled = settlementForRegistration({
    amountPaid: 199,
    payment_gateway: 'cashfree',
  });
  assert.equal(settled.gatewayFee, 3.18);
  assert.equal(settled.netToOrganizer, 195.82);
  assert.equal(settled.cashfree, true);
});

test('detects Cashfree from gateway string or payment_order_id', () => {
  assert.equal(isCashfreePayment({ payment_gateway: 'cashfree' }), true);
  assert.equal(isCashfreePayment({ payment_order_id: 'order_abc' }), true);
  assert.equal(isCashfreePayment({ payment_gateway: 'manual_organizer' }), false);
  assert.equal(isCashfreePayment({ payment_gateway: 'razorpay', payment_order_id: 'order_rzp' }), false);
  assert.equal(isCashfreePayment({ payment_gateway: 'razorpay_bundle', payment_order_id: 'order_rzp:1' }), false);
  assert.equal(isCashfreePayment({ payment_gateway: 'cashfree_bundle' }), true);
  assert.equal(isCashfreePayment({ payment_order_id: '' }), false);
  assert.equal(isCashfreePayment({}), false);
});

test('Cashfree and Razorpay revenue both apply the configured 1.6% gateway rate', () => {
  const summary = summarizeCashfreeSettlement([
    { amountPaid: 100, payment_gateway: 'cashfree', payment_order_id: 'order_cf' },
    { amountPaid: 200, payment_gateway: 'razorpay', payment_order_id: 'order_rzp' },
  ]);
  assert.equal(summary.grossCollected, 300);
  assert.equal(summary.gatewayFees, 4.8);
  assert.equal(summary.revenue, 295.2);
});

test('settlement summary accepts the Rush 2% Razorpay rate', () => {
  const summary = summarizeCashfreeSettlement([
    { amountPaid: 500, payment_gateway: 'razorpay', payment_order_id: 'order_rzp' },
    { amountPaid: 200, payment_gateway: 'manual_organizer' },
  ], { feeRate: 0.02 });
  assert.equal(summary.grossCollected, 700);
  assert.equal(summary.gatewayFees, 10);
  assert.equal(summary.revenue, 690);
});

test('manual / walk-in paid rows keep the full amountPaid', () => {
  const settled = settlementForRegistration({
    amountPaid: 199,
    payment_gateway: 'manual_organizer',
  });
  assert.equal(settled.gatewayFee, 0);
  assert.equal(settled.netToOrganizer, 199);
  assert.equal(settled.cashfree, false);

  const fields = cashfreeSettlementFields({
    amountPaid: 150,
    payment_gateway: 'manual_organizer',
  });
  assert.deepEqual(fields, { gatewayFee: 0, netToOrganizer: 150 });
});

test('older paid rows with only payment_order_id still take 1.6 percent', () => {
  const settled = settlementForRegistration({
    amountPaid: 99,
    payment_order_id: 'cf_legacy_1',
  });
  assert.equal(settled.gatewayFee, 1.58);
  assert.equal(settled.netToOrganizer, 97.42);
});

test('dashboard summary mixes Cashfree and manual entries', () => {
  const summary = summarizeCashfreeSettlement([
    { amountPaid: 199, payment_gateway: 'cashfree' },
    { amountPaid: 150, payment_order_id: 'order_2' },
    { amountPaid: 300, payment_gateway: 'manual_organizer' },
  ]);
  assert.equal(summary.grossCollected, 649);
  assert.equal(summary.gatewayFees, 5.58);
  assert.equal(summary.revenue, 643.42);
});

test('filterCashfreeConfirmedRegs drops ORDER_MISSING and no-snapshot ghosts', () => {
  const {
    cashfreeBaseOrderId,
    filterCashfreeConfirmedRegs,
  } = require('../src/utils/cashfreeGatewayFee');

  assert.equal(
    cashfreeBaseOrderId('order_bundleabc:aaaaaaaaaaaaaaaaaaaaaaaa'),
    'order_bundleabc',
  );

  const regs = [
    { amountPaid: 100, payment_gateway: 'cashfree', payment_order_id: 'ok1' },
    { amountPaid: 50, payment_gateway: 'cashfree', payment_order_id: 'ghost1' },
    { amountPaid: 75, payment_gateway: 'cashfree', payment_order_id: 'nosnap' },
    { amountPaid: 30, payment_gateway: 'razorpay', payment_order_id: 'rzp1' },
    { amountPaid: 40, payment_gateway: 'cashfree_bundle', payment_order_id: 'ok2:bbbbbbbbbbbbbbbbbbbbbbbb' },
  ];
  const settlements = [
    { orderId: 'ok1', status: 'SUCCESS' },
    { orderId: 'ghost1', status: 'ORDER_MISSING' },
    { orderId: 'ok2', status: 'PENDING' },
  ];
  const kept = filterCashfreeConfirmedRegs(regs, settlements);
  assert.deepEqual(
    kept.map((r) => r.payment_order_id),
    ['ok1', 'rzp1', 'ok2:bbbbbbbbbbbbbbbbbbbbbbbb'],
  );
  assert.equal(summarizeCashfreeSettlement(kept).grossCollected, 170);
});

test('scaleCompetitionSettlementToTotals matches locked gross and revenue', () => {
  const { scaleCompetitionSettlementToTotals } = require('../src/utils/cashfreeGatewayFee');
  const comps = [
    { id: 'a', name: 'A', grossCollected: 200, revenue: 196.8 },
    { id: 'b', name: 'B', grossCollected: 100, revenue: 98.4 },
    { id: 'c', name: 'C', grossCollected: 0, revenue: 0 },
  ];
  scaleCompetitionSettlementToTotals(comps, { grossCollected: 442381, revenue: 435303 });
  const sumG = comps.reduce((s, c) => s + (Number(c.grossCollected) || 0), 0);
  const sumR = comps.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
  assert.equal(Math.round(sumG * 100) / 100, 442381);
  assert.equal(Math.round(sumR * 100) / 100, 435303);
  assert.equal(comps[2].grossCollected, 0);
});

test('MindSpark totals keep each competition’s real payments and add new Razorpay there', () => {
  const { applyMindSparkCollectedTotals } = require('../src/utils/cashfreeGatewayFee');
  const comps = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ];
  const regs = [
    { competitionId: 'a', amountPaid: 400, payment_gateway: 'cashfree' },
    { competitionId: 'b', amountPaid: 200, payment_gateway: 'cashfree' },
    { competitionId: 'a', amountPaid: 140, payment_gateway: 'razorpay_bundle' },
  ];
  const applied = applyMindSparkCollectedTotals(comps, regs, {
    cashfreeLockGross: 1000,
    cashfreeLockRevenue: 984,
    razorpayPaidGross: 100,
    razorpayPaidRevenue: 98.4,
    gatewayFeeRate: 0.016,
    additionalDeduction: 0,
  });
  assert.equal(comps[0].grossCollected, 540);
  assert.equal(comps[0].revenue, 531.36);
  assert.equal(comps[1].grossCollected, 200);
  assert.equal(comps[1].revenue, 196.8);
  assert.equal(applied.grossCollected, 1140);
  assert.equal(applied.revenue, 1121.76);
  assert.equal(applied.earlierClearGross, 400);
  assert.equal(applied.earlierClearRevenue, 393.6);
});

test('locked Cashfree 435303 stays put while live Razorpay above 9314 increases revenue', () => {
  const { mindSparkLockedTotals } = require('../src/utils/cashfreeGatewayFee');
  const override = {
    cashfreeLockGross: 442381,
    cashfreeLockRevenue: 435303,
    razorpayPaidGross: 9314,
    razorpayPaidRevenue: 9165,
    gatewayFeeRate: 0.016,
  };
  const held = mindSparkLockedTotals({
    cashfreeGross: 380000,
    cashfreeRevenue: 373920,
    razorpayGross: 9314,
    override,
  });
  assert.equal(held.grossCollected, 451695);
  assert.equal(held.revenue, 444468);
  assert.equal(held.razorpayPaidGross, 9314);

  const grown = mindSparkLockedTotals({
    cashfreeGross: 380000,
    cashfreeRevenue: 373920,
    razorpayGross: 10314,
    override,
  });
  assert.equal(grown.grossCollected, 452695);
  assert.equal(grown.revenue, 445451.98);
  assert.equal(grown.razorpayPaidGross, 10314);
  assert.equal(grown.cashfreeRevenue, 435303);
});
