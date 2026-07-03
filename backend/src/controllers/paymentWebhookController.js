const PaymentOrder = require('../model/payment_order_model');
const {
  verifyWebhookSignature,
  inspectWebhookSignature,
} = require('../services/cashfreeService');

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

    // Empty/ping body (Cashfree dashboard "Test" often sends this) — acknowledge.
    const isEmptyBody = !rawBody || rawBody.trim() === '' || rawBody.trim() === '{}';

    let isValid = false;
    try {
      isValid = verifyWebhookSignature({ signature, timestamp, rawBody });
    } catch (secretErr) {
      if (secretErr.code === 'WEBHOOK_SECRET_MISSING') {
        console.error('[paymentWebhook]', secretErr.message);
        // Acknowledge so Cashfree's test/health checks pass; nothing is processed.
        return res.status(200).send('OK');
      }
      throw secretErr;
    }

    // Security: only PROCESS signed webhooks. But always return 200 so Cashfree's
    // dashboard test passes and it doesn't enter an endless retry loop. Payments are
    // still confirmed independently via client-side verify, so no order is ever
    // trusted from an unsigned request.
    if (!isValid) {
      // Detailed, non-secret-leaking diagnostics to pinpoint the mismatch.
      const diag = inspectWebhookSignature({ signature, timestamp, rawBody });
      console.warn(
        '[paymentWebhook] Invalid webhook signature — acknowledged without processing',
        JSON.stringify(
          {
            hasSignature: diag.hasSignature,
            hasTimestamp: diag.hasTimestamp,
            timestamp: diag.timestamp,
            bodyLength: diag.bodyLength,
            cashfreeEnv: diag.cashfreeEnv,
            contentType: req.headers['content-type'] || null,
            webhookVersion: req.headers['x-webhook-version'] || null,
            bodyIsBuffer: Buffer.isBuffer(req.body),
            receivedSignature: diag.receivedSignature,
            candidates: diag.candidates.map((c) => ({
              envVar: c.envVar,
              secretLen: c.secretLen,
              computed: c.computed,
              matches: c.matches,
            })),
          },
          null,
          2
        )
      );
      return res.status(200).send('OK');
    }

    if (isEmptyBody) {
      return res.status(200).send('OK');
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Signature was valid but body isn't JSON — acknowledge, nothing to process.
      return res.status(200).send('OK');
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
      try {
        await PaymentOrder.findOneAndUpdate(
          { orderId },
          {
            status: 'PAID',
            ...(paymentId ? { paymentId: String(paymentId) } : {}),
          },
          { upsert: false, new: true }
        );
      } catch (dbErr) {
        console.error('[paymentWebhook] Failed to mark order PAID:', dbErr.message);
      }
    } else if (isFailed) {
      try {
        await PaymentOrder.findOneAndUpdate(
          { orderId },
          { status: 'FAILED' },
          { upsert: false }
        );
      } catch (dbErr) {
        console.error('[paymentWebhook] Failed to mark order FAILED:', dbErr.message);
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    if (err.code === 'WEBHOOK_SECRET_MISSING') {
      console.error('[paymentWebhook]', err.message);
      return res.status(200).send('OK');
    }
    console.error('[paymentWebhook] error:', err.message);
    return res.status(200).send('OK');
  }
};
