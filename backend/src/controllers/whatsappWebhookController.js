const {
  summarizeWhatsAppWebhook,
  classifyWhatsAppWebhookEvents,
  validateWhatsAppWebhookSubscription,
} = require('../utils/whatsappWebhookEvents');

/**
 * GET /api/whatsapp/webhook
 * Meta webhook verification (hub.mode / hub.verify_token / hub.challenge).
 */
exports.verifyWhatsAppWebhook = (req, res) => {
  const result = validateWhatsAppWebhookSubscription({
    mode: req.query['hub.mode'],
    verifyToken: req.query['hub.verify_token'],
    challenge: req.query['hub.challenge'],
    expectedVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  });

  if (!result.ok) {
    if (result.reason === 'missing_verify_token_config') {
      console.error('[whatsappWebhook] WHATSAPP_VERIFY_TOKEN is not configured');
    } else {
      console.warn('[whatsappWebhook] Verification rejected', { reason: result.reason });
    }
    return res.sendStatus(403);
  }

  return res.status(200).send(result.challenge);
};

/**
 * POST /api/whatsapp/webhook
 * Meta WhatsApp Cloud API event notifications.
 */
exports.handleWhatsAppWebhook = (req, res) => {
  // Acknowledge immediately so Meta does not retry while we process.
  res.status(200).send('OK');

  setImmediate(() => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const summary = summarizeWhatsAppWebhook(body);
      const classified = classifyWhatsAppWebhookEvents(body);

      console.log('[whatsappWebhook] event received', {
        object: summary.object,
        entryCount: summary.entryCount,
        eventCount: summary.events.length,
        messageEvents: classified.messages.length,
        statusEvents: classified.statuses.length,
        fields: summary.events.map((event) => event.field).filter(Boolean),
        messageTypes: summary.events.flatMap((event) => event.messageTypes),
        statusTypes: summary.events.flatMap((event) => event.statusTypes),
      });

      // Future hooks: process inbound messages and delivery/read status updates.
      if (classified.messages.length > 0) {
        // e.g. await handleIncomingWhatsAppMessages(classified.messages, body);
      }
      if (classified.statuses.length > 0) {
        // e.g. await handleWhatsAppStatusUpdates(classified.statuses, body);
      }
    } catch (err) {
      console.error('[whatsappWebhook] processing error:', err.message);
    }
  });
};
