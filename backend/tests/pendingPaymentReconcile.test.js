/**
 * Unit tests for pending Cashfree reconcile (stubbed model + Cashfree).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const stubs = {
  pending: [],
  verifyResult: null,
  updated: null,
  sportsFulfillCalls: 0,
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request.endsWith('model/payment_order_model') || request === '../model/payment_order_model') {
    return {
      find: () => ({
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        select() {
          return this;
        },
        lean: async () => stubs.pending,
      }),
      findOne: async () => stubs.updated,
      findOneAndUpdate: async () => stubs.updated,
    };
  }
  if (request.endsWith('services/cashfreeService') || request === './cashfreeService') {
    const real = originalLoad.call(this, request, parent, isMain);
    return {
      ...real,
      verifyCashfreePayment: async () => stubs.verifyResult,
    };
  }
  if (
    request.endsWith('services/sportsPaymentFulfillment') ||
    request === './sportsPaymentFulfillment'
  ) {
    return {
      fulfillSportsFromPaidOrder: async () => {
        stubs.sportsFulfillCalls += 1;
        return { ok: true };
      },
    };
  }
  if (request.endsWith('utils/logger') || request === '../utils/logger') {
    return { logger: { info() {}, warn() {}, error() {}, debug() {} } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { reconcilePendingCashfreeOrders } = require('../src/services/pendingPaymentReconcileService');

test.after(() => {
  Module._load = originalLoad;
});

test('reconcile marks PENDING sports orders PAID and fulfills when Cashfree verifies', async () => {
  stubs.sportsFulfillCalls = 0;
  stubs.pending = [
    {
      orderId: 'order_orphan_1',
      entityType: 'sports',
      cashfreeMerchant: 'events',
      status: 'PENDING',
      orderTags: { formData: { full_name: 'Test' } },
    },
  ];
  stubs.verifyResult = {
    verified: true,
    status: 'paid',
    orderId: 'order_orphan_1',
    paymentId: 'pay_1',
  };
  stubs.updated = {
    orderId: 'order_orphan_1',
    entityType: 'sports',
    status: 'PAID',
    paymentId: 'pay_1',
    orderTags: { formData: { full_name: 'Test' } },
  };

  const summary = await reconcilePendingCashfreeOrders({
    minAgeMs: 0,
    maxAgeMs: 60 * 60 * 1000,
    limit: 10,
  });

  assert.equal(summary.checked, 1);
  assert.equal(summary.paid, 1);
  assert.equal(summary.fulfilled, 1);
  assert.equal(summary.errors, 0);
  assert.equal(stubs.sportsFulfillCalls, 1);
});

test('reconcile skips orders that are not PAID at Cashfree', async () => {
  stubs.sportsFulfillCalls = 0;
  stubs.pending = [
    {
      orderId: 'order_active',
      entityType: 'sports',
      cashfreeMerchant: 'events',
      orderTags: { formData: {} },
    },
  ];
  stubs.verifyResult = { verified: false, status: 'pending', orderId: 'order_active' };
  stubs.updated = null;

  const summary = await reconcilePendingCashfreeOrders({
    minAgeMs: 0,
    maxAgeMs: 60 * 60 * 1000,
  });

  assert.equal(summary.paid, 0);
  assert.equal(summary.fulfilled, 0);
  assert.equal(stubs.sportsFulfillCalls, 0);
});
