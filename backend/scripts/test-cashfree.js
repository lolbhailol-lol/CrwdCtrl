#!/usr/bin/env node
/**
 * Quick Cashfree connectivity check for local dev.
 * Run: node scripts/test-cashfree.js
 */
require('dotenv').config();

const { createCashfreeOrder, verifyCashfreePayment } = require('../src/services/cashfreeService');

async function main() {
  const env = process.env.CASHFREE_ENV || 'sandbox';
  const hasId = !!process.env.CASHFREE_CLIENT_ID;
  const hasSecret = !!process.env.CASHFREE_CLIENT_SECRET;

  console.log('Cashfree env:', env);
  console.log('Client ID set:', hasId);
  console.log('Client secret set:', hasSecret);

  if (!hasId || !hasSecret) {
    console.error('\n❌ Missing CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET.');
    console.error('   Add them to backend/.env and save the file.');
    process.exit(1);
  }

  try {
    const order = await createCashfreeOrder({
      orderAmount: 10,
      customerDetails: {
        customerId: 'local_test_user',
        customerName: 'Local Test',
        customerEmail: 'test@crwdctrl.com',
        customerPhone: '9999999999',
      },
      orderNote: 'CrwdCtrl localhost test',
    });

    console.log('\n✅ Order created');
    console.log('   order_id:', order.order_id);
    console.log('   payment_session_id:', order.payment_session_id ? '(present)' : '(missing)');
    console.log('\nFrontend checkout needs:');
    console.log('   VITE_CASHFREE_MODE=' + env);
    console.log('   Open http://localhost:5173 and test a paid registration.');
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error('\n❌ Cashfree API failed:', status, data?.message || data?.code || err.message);
    if (status === 401) {
      console.error('\nTips:');
      console.error('  • Use Payment Gateway API keys (not Payouts).');
      console.error('  • sandbox keys → CASHFREE_ENV=sandbox');
      console.error('  • production keys → CASHFREE_ENV=production');
      console.error('  • Regenerate keys in Cashfree Dashboard if needed.');
    }
    process.exit(1);
  }
}

main();
