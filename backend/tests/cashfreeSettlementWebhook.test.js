const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyFinanceWebhook,
  normalizeSettlementPayload,
  normalizeRefundPayload,
  isSettlementEventType,
  isRefundEventType,
} = require('../src/services/cashfreeSettlementSync');

test('PAYMENT_SUCCESS is not treated as a settlement/refund finance event', () => {
  const classified = classifyFinanceWebhook({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: { order: { order_id: 'order_1', order_status: 'PAID' } },
  });
  assert.equal(classified.handled, false);
  assert.equal(isSettlementEventType('PAYMENT_SUCCESS_WEBHOOK'), false);
});

test('settlement webhook is classified without inventing a transfer date', () => {
  assert.equal(isSettlementEventType('SETTLEMENT_SUCCESS'), true);
  const classified = classifyFinanceWebhook({
    type: 'SETTLEMENT_SUCCESS',
    data: {
      order: { order_id: 'order_1' },
      settlement: { cf_settlement_id: '6121238', settlement_amount: 195.82 },
    },
  });
  assert.equal(classified.handled, true);
  assert.equal(classified.kind, 'settlement');
  assert.equal(classified.normalized.orderId, 'order_1');
  assert.equal(classified.normalized.cfSettlementId, '6121238');
  assert.equal(classified.normalized.transferTime, null);
  assert.equal(classified.normalized.status, 'SUCCESS');
});

test('settlement date is stored only when Cashfree sends transfer_time', () => {
  const withDate = normalizeSettlementPayload({
    order_id: 'order_1',
    cf_settlement_id: '9',
    transfer_time: '2026-08-02T12:00:00+05:30',
  });
  assert.ok(withDate.transferTime instanceof Date);
  const withoutDate = normalizeSettlementPayload({
    order_id: 'order_1',
    cf_settlement_id: '9',
  });
  assert.equal(withoutDate.transferTime, null);
  const garbageDate = normalizeSettlementPayload({
    order_id: 'order_1',
    cf_settlement_id: '9',
    transfer_time: 'T+1',
  });
  assert.equal(garbageDate.transferTime, null);
});

test('refund webhook normalizes amount and does not need payment status changes', () => {
  assert.equal(isRefundEventType('REFUND_STATUS_WEBHOOK'), true);
  const classified = classifyFinanceWebhook({
    type: 'REFUND_STATUS_WEBHOOK',
    data: {
      order: { order_id: 'order_1' },
      refund: { cf_refund_id: 'rf_1', refund_amount: 50, refund_status: 'SUCCESS' },
    },
  });
  assert.equal(classified.handled, true);
  assert.equal(classified.kind, 'refund');
  assert.equal(classified.normalized.amount, 50);
  assert.equal(classified.normalized.orderId, 'order_1');
  const parsed = normalizeRefundPayload({
    order_id: 'order_1',
    refund_amount: 25,
    cf_refund_id: 'rf_2',
  });
  assert.equal(parsed.amount, 25);
});

test('empty settlement payload does not invent settlement fields', () => {
  const classified = classifyFinanceWebhook({
    type: 'SETTLEMENT_SUCCESS',
    data: { order: { order_id: 'order_1' } },
  });
  assert.equal(classified.handled, true);
  assert.equal(classified.normalized, null);
});

test('Cashfree settlement entity with amount but no transfer stays pending', () => {
  const parsed = normalizeSettlementPayload({
    entity: 'settlement',
    order_id: 'order_1',
    cf_settlement_id: null,
    transfer_time: null,
    transfer_utr: null,
    settlement_amount: 195.82,
  });
  assert.equal(parsed.empty, false);
  assert.equal(parsed.status, 'PENDING');
  assert.equal(parsed.cfSettlementId, null);
  assert.equal(parsed.transferTime, null);
  assert.equal(parsed.settlementAmount, 195.82);
});

test('2025 Cashfree settlement entity maps SUCCESS and processed date', () => {
  const parsed = normalizeSettlementPayload({
    order_details: { order_id: 'order_1' },
    payment_details: { cf_payment_id: '6183934088', settlement_amount: 475 },
    settlement_details: {
      cf_settlement_id: '312048765',
      status: 'SUCCESS',
      settlement_utr: 'CB0312048765',
      settlement_processed_on: '2026-01-20T09:15:22+05:30',
    },
  });
  assert.equal(parsed.orderId, 'order_1');
  assert.equal(parsed.cfSettlementId, '312048765');
  assert.equal(parsed.cfPaymentId, '6183934088');
  assert.equal(parsed.status, 'SUCCESS');
  assert.equal(parsed.transferUtr, 'CB0312048765');
  assert.ok(parsed.transferTime instanceof Date);
  const pending = normalizeSettlementPayload({
    order_details: { order_id: 'order_2' },
    settlement_details: { cf_settlement_id: '9', status: 'PENDING' },
  });
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.transferTime, null);
  assert.equal(pending.empty, false);
});
