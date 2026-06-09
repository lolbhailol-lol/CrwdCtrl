const PaymentOrder = require('../model/payment_order_model');
const { verifyWebhookSignature } = require('../services/cashfreeService');

/**
 * POST /api/payment/webhook
 * Cashfree server-to-server payment notifications (signature-verified).
 */
exports.handleCashfreeWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBody =
      typeof req.body === 'string' ? req.body : req.body?.toString?.('utf8') || '';

    // Security: reject unsigned or tampered webhooks
    const isValid = verifyWebhookSignature({ signature, timestamp, rawBody });
    if (!isValid) {
      console.warn('[paymentWebhook] Invalid webhook signature');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid webhook JSON' });
    }

    const eventType = payload.type || payload.event || '';
    const orderData = payload.data?.order || payload.order || {};
    const paymentData = payload.data?.payment || payload.payment || {};

    const orderId = orderData.order_id || orderData.orderId || payload.data?.order_id;
    const orderStatus = (orderData.order_status || orderData.orderStatus || '').toUpperCase();
    const paymentId =
      paymentData.cf_payment_id || paymentData.payment_id || paymentData.cfPaymentId || null;

    if (!orderId) {
      return res.status(200).json({ success: true, message: 'Ignored — no order id' });
    }

    const isPaid =
      eventType.includes('PAYMENT_SUCCESS') ||
      orderStatus === 'PAID' ||
      (paymentData.payment_status || '').toUpperCase() === 'SUCCESS';

    const isFailed =
      eventType.includes('PAYMENT_FAILED') ||
      orderStatus === 'FAILED' ||
      (paymentData.payment_status || '').toUpperCase() === 'FAILED';

    if (isPaid) {
      // Idempotent: webhook may be delivered more than once
      await PaymentOrder.findOneAndUpdate(
        { orderId },
        {
          status: 'PAID',
          ...(paymentId ? { paymentId: String(paymentId) } : {}),
        },
        { upsert: false, new: true }
      );
    } else if (isFailed) {
      await PaymentOrder.findOneAndUpdate(
        { orderId },
        { status: 'FAILED' },
        { upsert: false }
      );
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    if (err.code === 'WEBHOOK_SECRET_MISSING') {
      console.error('[paymentWebhook]', err.message);
      return res.status(503).json({ success: false, message: 'Webhook not configured' });
    }
    console.error('[paymentWebhook] error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
