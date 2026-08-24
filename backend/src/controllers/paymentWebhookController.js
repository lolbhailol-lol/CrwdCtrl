const PaymentOrder = require('../model/payment_order_model');
const {
  verifyWebhookSignature,
  inspectWebhookSignature,
} = require('../services/cashfreeService');
const { captureFlowEvent } = require('../config/sentry');

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
      captureFlowEvent('payment_webhook', 'signature_invalid', {
        hasSignature: diag.hasSignature,
        hasTimestamp: diag.hasTimestamp,
        cashfreeEnv: diag.cashfreeEnv,
        bodyLength: diag.bodyLength,
      });
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

    // Settlement / refund webhooks: persist finance snapshots only.
    // Do not change PaymentOrder amounts or the PAID fulfillment path.
    try {
      const { applyWebhookFinanceEvent } = require('../services/cashfreeSettlementSync');
      const finance = await applyWebhookFinanceEvent(payload);
      if (finance.handled) {
        return res.status(200).send('OK');
      }
    } catch (financeErr) {
      console.error('[paymentWebhook] finance event failed:', financeErr?.message || financeErr);
      // Fall through to existing payment handling so checkout/fulfillment is not blocked.
    }

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

    const isDropped =
      eventType.includes('USER_DROPPED') ||
      eventType.includes('PAYMENT_CANCELLED') ||
      ['EXPIRED', 'CANCELLED', 'TERMINATED', 'USER_DROPPED'].includes(orderStatus);

    if (isPaid) {
      try {
        const updated = await PaymentOrder.findOneAndUpdate(
          { orderId },
          {
            status: 'PAID',
            ...(paymentId ? { paymentId: String(paymentId) } : {}),
          },
          { upsert: false, new: true }
        );
        // Auto-create EventShow registration when draft was stored at checkout —
        // so booking appears even if the user never returns from Google Pay.
        if (updated?.entityType === 'event_show' && updated?.orderTags?.registrationDraft) {
          const { fulfillEventShowFromPaidOrder } = require('../services/eventShowPaymentFulfillment');
          fulfillEventShowFromPaidOrder(updated).catch((fulfillErr) => {
            console.error(
              '[paymentWebhook] EventShow fulfill failed:',
              fulfillErr?.message || fulfillErr,
            );
          });
        }
        if (['fest', 'competition'].includes(updated?.entityType) && updated?.orderTags?.registrationDraft) {
          const { fulfillFestCompetitionFromPaidOrder } = require('../services/festCompetitionPaymentFulfillment');
          fulfillFestCompetitionFromPaidOrder(updated).catch((fulfillErr) => {
            console.error(
              '[paymentWebhook] Fest/competition fulfill failed:',
              fulfillErr?.message || fulfillErr,
            );
          });
        }
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
    } else if (isDropped) {
      try {
        await PaymentOrder.findOneAndUpdate(
          { orderId, status: 'PENDING' },
          { status: 'EXPIRED' },
          { upsert: false }
        );
      } catch (dbErr) {
        console.error('[paymentWebhook] Failed to mark order EXPIRED:', dbErr.message);
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
