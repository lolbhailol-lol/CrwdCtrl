const PaymentOrder = require('../model/payment_order_model');
const Registration = require('../model/registration_model');
const {
  verifyWebhookSignature,
  inspectWebhookSignature,
} = require('../services/cashfreeService');
const { captureFlowEvent } = require('../config/sentry');
const { verifyRazorpayWebhookSignature } = require('../services/razorpayService');

function fulfillPaidOrder(order) {
  if (order?.entityType === 'event_show' && order?.orderTags?.registrationDraft) {
    const { fulfillEventShowFromPaidOrder } = require('../services/eventShowPaymentFulfillment');
    return fulfillEventShowFromPaidOrder(order);
  }
  if (['fest', 'competition'].includes(order?.entityType) && order?.orderTags?.registrationDraft) {
    const { fulfillFestCompetitionFromPaidOrder } = require('../services/festCompetitionPaymentFulfillment');
    return fulfillFestCompetitionFromPaidOrder(order);
  }
  if (order?.entityType === 'competition_bundle') {
    const { fulfillMindSparkBundle } = require('../services/mindsparkBundleService');
    return fulfillMindSparkBundle(order);
  }
  if (order?.entityType === 'sports' && order?.orderTags?.formData) {
    const { fulfillSportsFromPaidOrder } = require('../services/sportsPaymentFulfillment');
    return fulfillSportsFromPaidOrder(order);
  }
  if (order?.entityType === 'trek' && order?.orderTags?.formData) {
    const { fulfillTrekFromPaidOrder } = require('../services/trekPaymentFulfillment');
    return fulfillTrekFromPaidOrder(order);
  }
  return Promise.resolve();
}

/** POST /api/payment/razorpay/webhook */
exports.handleRazorpayWebhook = async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  const signature = req.headers['x-razorpay-signature'];

  try {
    if (!verifyRazorpayWebhookSignature({ rawBody, signature })) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }

    const event = String(payload.event || '').toLowerCase();
    const payment = payload.payload?.payment?.entity || {};
    const order = payload.payload?.order?.entity || {};
    const orderId = payment.order_id || order.id;
    const paymentId = payment.id || null;

    if (!orderId) return res.status(200).json({ success: true, ignored: true });

    if (['payment.captured', 'order.paid'].includes(event)) {
      const updated = await PaymentOrder.findOneAndUpdate(
        { orderId, gateway: 'razorpay' },
        { status: 'PAID', ...(paymentId ? { paymentId: String(paymentId) } : {}) },
        { upsert: false, new: true },
      );
      if (updated) {
        fulfillPaidOrder(updated).catch((err) => {
          console.error('[razorpayWebhook] fulfillment failed:', err?.message || err);
        });
      }
    } else if (event === 'payment.failed') {
      await PaymentOrder.findOneAndUpdate(
        { orderId, gateway: 'razorpay', status: 'PENDING' },
        { status: 'FAILED', ...(paymentId ? { paymentId: String(paymentId) } : {}) },
        { upsert: false },
      );
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    if (err.code === 'RAZORPAY_WEBHOOK_SECRET_MISSING') {
      console.error('[razorpayWebhook]', err.message);
      return res.status(503).json({ success: false, message: 'Webhook not configured' });
    }
    console.error('[razorpayWebhook] error:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

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
        if (finance.kind === 'refund' && finance.orderId) {
          const refundStatus = String(finance.status || '').toUpperCase();
          if (refundStatus === 'SUCCESS') {
            await Registration.updateMany(
              { $or: [{ payment_order_id: finance.orderId }, { 'responses.bundle_cashfree_order_id': finance.orderId }] },
              { $set: { status: 'rejected', 'responses.refund_status': 'refunded' } },
            ).catch(() => {});
          } else if (['FAILED', 'CANCELLED'].includes(refundStatus)) {
            await Registration.updateMany(
              { $and: [{ $or: [{ payment_order_id: finance.orderId }, { 'responses.bundle_cashfree_order_id': finance.orderId }] }, { 'responses.refund_status': 'pending' }] },
              { $set: { status: 'approved', 'responses.refund_status': refundStatus.toLowerCase() } },
            ).catch(() => {});
          }
        }
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
        if (updated?.entityType === 'competition_bundle') {
          const { fulfillMindSparkBundle } = require('../services/mindsparkBundleService');
          fulfillMindSparkBundle(updated).catch((fulfillErr) => {
            console.error('[paymentWebhook] MindSpark bundle fulfill failed:', fulfillErr?.message || fulfillErr);
          });
        }
        if (updated?.entityType === 'sports' && updated?.orderTags?.formData) {
          const { fulfillSportsFromPaidOrder } = require('../services/sportsPaymentFulfillment');
          fulfillSportsFromPaidOrder(updated).catch((fulfillErr) => {
            console.error(
              '[paymentWebhook] Sports fulfill failed:',
              fulfillErr?.message || fulfillErr,
            );
          });
        }
        if (updated?.entityType === 'trek' && updated?.orderTags?.formData) {
          const { fulfillTrekFromPaidOrder } = require('../services/trekPaymentFulfillment');
          fulfillTrekFromPaidOrder(updated).catch((fulfillErr) => {
            console.error(
              '[paymentWebhook] Trek fulfill failed:',
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
        const failedOrder = await PaymentOrder.findOne({ orderId }).select('orderTags.slotReservationToken').lean();
        if (failedOrder?.orderTags?.slotReservationToken) {
          const { releaseCompetitionSlot } = require('../services/competitionSlotReservationService');
          await releaseCompetitionSlot(failedOrder.orderTags.slotReservationToken).catch(() => {});
        }
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
        const droppedOrder = await PaymentOrder.findOne({ orderId }).select('orderTags.slotReservationToken').lean();
        if (droppedOrder?.orderTags?.slotReservationToken) {
          const { releaseCompetitionSlot } = require('../services/competitionSlotReservationService');
          await releaseCompetitionSlot(droppedOrder.orderTags.slotReservationToken).catch(() => {});
        }
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
