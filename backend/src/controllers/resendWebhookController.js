const { Resend } = require('resend');

/**
 * POST /api/resend/webhook
 * Resend server-to-server email event notifications (Svix signature-verified).
 */
exports.handleResendWebhook = async (req, res) => {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret) {
      console.error('[resendWebhook] RESEND_WEBHOOK_SECRET is not configured');
      // Acknowledge so Resend does not retry endlessly; nothing is processed.
      return res.status(200).send('OK');
    }

    const rawBody =
      typeof req.body === 'string' ? req.body : req.body?.toString?.('utf8') || '';

    if (!rawBody || rawBody.trim() === '' || rawBody.trim() === '{}') {
      return res.status(200).send('OK');
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    let event;
    try {
      event = resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: req.headers['svix-id'],
          timestamp: req.headers['svix-timestamp'],
          signature: req.headers['svix-signature'],
        },
        webhookSecret: secret,
      });
    } catch (verifyErr) {
      console.warn(
        '[resendWebhook] Invalid webhook signature — acknowledged without processing:',
        verifyErr.message
      );
      return res.status(200).send('OK');
    }

    switch (event.type) {
      case 'email.bounced':
        console.warn('[resendWebhook] bounce', {
          emailId: event.data?.email_id,
          to: event.data?.to,
        });
        break;
      case 'email.complained':
        console.warn('[resendWebhook] complaint', {
          emailId: event.data?.email_id,
          to: event.data?.to,
        });
        break;
      case 'email.failed':
      case 'email.suppressed':
        console.error('[resendWebhook]', event.type, {
          emailId: event.data?.email_id,
          to: event.data?.to,
        });
        break;
      case 'email.delivered':
      case 'email.sent':
      case 'email.scheduled':
      case 'email.opened':
      case 'email.clicked':
      case 'email.delivery_delayed':
        console.log('[resendWebhook]', event.type, {
          emailId: event.data?.email_id,
          to: event.data?.to,
        });
        break;
      default:
        console.log('[resendWebhook] unhandled event', event.type);
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[resendWebhook] error:', err.message);
    // Still 200 — avoid Resend retry storms for unexpected handler bugs.
    return res.status(200).send('OK');
  }
};
