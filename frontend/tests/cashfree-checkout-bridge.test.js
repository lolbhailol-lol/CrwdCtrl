import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCashfreeCheckoutBridgeUrl,
  normalizeCashfreeMode,
} from '../src/utils/cashfreeCheckoutBridge.js';

test('mobile Cashfree handoff uses the lightweight checkout bridge', () => {
  const url = new URL(buildCashfreeCheckoutBridgeUrl({
    paymentSessionId: 'session_abc',
    orderId: 'order_123',
    cashfreeMode: 'production',
    origin: 'https://www.crwdctrl.in',
  }));
  assert.equal(url.origin, 'https://www.crwdctrl.in');
  assert.equal(url.pathname, '/payment/checkout');
  assert.equal(url.searchParams.get('payment_session_id'), 'session_abc');
  assert.equal(url.searchParams.get('order_id'), 'order_123');
  assert.equal(url.searchParams.get('mode'), 'production');
});

test('Cashfree mode cannot be injected through the checkout URL', () => {
  assert.equal(normalizeCashfreeMode('sandbox'), 'sandbox');
  assert.equal(normalizeCashfreeMode('production'), 'production');
  assert.equal(normalizeCashfreeMode('javascript:alert(1)'), 'production');
});
