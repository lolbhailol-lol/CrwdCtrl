const {
  createCashfreeOrder,
  verifyCashfreePayment,
  createCashfreeRefund,
} = require('../src/services/cashfreeService');

if (process.env.SMOKE_CONFIRM_REAL_MONEY !== 'YES') {
  console.error('Set SMOKE_CONFIRM_REAL_MONEY=YES to acknowledge a real ₹1 charge/refund.');
  process.exit(1);
}

const existingOrderId = String(process.env.SMOKE_ORDER_ID || '').trim();

(async () => {
  if (!existingOrderId) {
    const phone = String(process.env.SMOKE_CUSTOMER_PHONE || '').trim();
    const email = String(process.env.SMOKE_CUSTOMER_EMAIL || '').trim();
    if (!phone || !email) throw new Error('Set SMOKE_CUSTOMER_PHONE and SMOKE_CUSTOMER_EMAIL.');
    const order = await createCashfreeOrder({
      orderAmount: 1,
      customerDetails: { customerId: `smoke_${Date.now()}`, customerName: 'CrwdCtrl Smoke Test', customerEmail: email, customerPhone: phone },
      orderNote: 'CrwdCtrl pre-event ₹1 payment/refund smoke test',
      orderTags: { purpose: 'mindspark_smoke_test' },
    });
    console.log(`Open: https://www.crwdctrl.in/payment/checkout?payment_session_id=${encodeURIComponent(order.payment_session_id)}&order_id=${encodeURIComponent(order.order_id)}`);
    console.log(`After paying, rerun with SMOKE_ORDER_ID=${order.order_id}`);
    return;
  }
  const verification = await verifyCashfreePayment({ orderId: existingOrderId });
  if (!verification.verified) throw new Error(`Order is not paid: ${verification.status}`);
  const refundId = `smoke_${Date.now()}`;
  const refund = await createCashfreeRefund({ orderId: existingOrderId, amount: 1, refundId, note: 'CrwdCtrl smoke test refund' });
  console.log(JSON.stringify({ verified: true, refundId, refund }, null, 2));
})();
