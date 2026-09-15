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
  assert.equal(isCashfreePayment({ payment_order_id: '' }), false);
  assert.equal(isCashfreePayment({}), false);
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
