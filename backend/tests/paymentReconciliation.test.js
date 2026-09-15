const test = require('node:test');
const assert = require('node:assert/strict');

const {
  reconcileCashfreeRows,
  mapCashfreeCsvRow,
  parseCsvBuffer,
} = require('../src/services/paymentReconciliationService');

test('CSV headers map order id and payment id flexibly', () => {
  const row = mapCashfreeCsvRow({
    'Order ID': 'order_abc',
    'cf_payment_id': '998877',
    'Order Amount': '199.00',
    'payment_status': 'SUCCESS',
  });
  assert.equal(row.orderId, 'order_abc');
  assert.equal(row.paymentId, '998877');
  assert.equal(row.amount, 199);
});

test('reconcile matched / unmatched / amount mismatch / duplicate', () => {
  const crwdctrl = [
    { orderId: 'order_1', paymentId: 'p1', netGross: 199, paymentStatus: 'PAID' },
    { orderId: 'order_2', paymentId: 'p2', netGross: 150, paymentStatus: 'PAID' },
    { orderId: 'order_3', paymentId: 'p3', netGross: 99, paymentStatus: 'PAID' },
  ];
  const cashfree = [
    { orderId: 'order_1', paymentId: 'p1', amount: 199, paymentStatus: 'SUCCESS' },
    { orderId: 'order_2', paymentId: 'p2', amount: 140, paymentStatus: 'SUCCESS' },
    { orderId: 'order_cf_only', paymentId: 'px', amount: 50, paymentStatus: 'SUCCESS' },
    { orderId: 'order_dup', paymentId: 'pd', amount: 10, paymentStatus: 'SUCCESS' },
    { orderId: 'order_dup', paymentId: 'pd', amount: 10, paymentStatus: 'SUCCESS' },
  ];
  const result = reconcileCashfreeRows(crwdctrl, cashfree);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.amountMismatchCount, 1);
  assert.equal(result.unmatchedCashfreeCount, 1);
  assert.ok(result.duplicateCount >= 2);
  assert.equal(result.unmatchedCrwdctrlCount, 1);
  assert.equal(result.rows.find((row) => row.kind === 'matched').orderId, 'order_1');
  assert.equal(result.rows.find((row) => row.kind === 'amount_mismatch').orderId, 'order_2');
  assert.equal(result.rows.find((row) => row.kind === 'unmatched_cashfree').orderId, 'order_cf_only');
  assert.equal(result.rows.find((row) => row.kind === 'unmatched_crwdctrl').orderId, 'order_3');
});

test('does not match Cashfree and CrwdCtrl rows by amount alone', () => {
  const result = reconcileCashfreeRows(
    [{ orderId: 'order_a', paymentId: 'pa', netGross: 199 }],
    [{ orderId: 'order_b', paymentId: 'pb', amount: 199 }],
  );
  assert.equal(result.matchedCount, 0);
  assert.equal(result.amountMismatchCount, 0);
  assert.equal(result.unmatchedCashfreeCount, 1);
  assert.equal(result.unmatchedCrwdctrlCount, 1);
});

test('parseCsvBuffer reads a Cashfree-like export', async () => {
  const csv = 'order_id,cf_payment_id,order_amount,payment_status\norder_x,111,99.00,SUCCESS\n';
  const rows = await parseCsvBuffer(Buffer.from(csv));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orderId, 'order_x');
  assert.equal(rows[0].paymentId, '111');
  assert.equal(rows[0].amount, 99);
});
