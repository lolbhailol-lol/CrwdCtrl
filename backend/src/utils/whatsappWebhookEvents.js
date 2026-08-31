/**
 * Safe WhatsApp webhook payload helpers.
 * Never include phone numbers, message bodies, or secrets in summaries.
 */

function pickMessageType(message = {}) {
  if (message.type) return String(message.type);
  return 'unknown';
}

function pickStatusType(status = {}) {
  if (status.status) return String(status.status);
  return 'unknown';
}

/**
 * Summarize a Meta WhatsApp webhook body for logging and future routing.
 * @returns {{ object: string|null, entryCount: number, events: Array<object> }}
 */
function summarizeWhatsAppWebhook(body = {}) {
  const object = body.object != null ? String(body.object) : null;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const events = [];

  for (const entry of entries) {
    const wabaId = entry?.id != null ? String(entry.id) : null;
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const field = change?.field != null ? String(change.field) : null;
      const value = change?.value && typeof change.value === 'object' ? change.value : {};
      const event = {
        wabaId,
        field,
        messagingProduct: value.messaging_product != null ? String(value.messaging_product) : null,
        phoneNumberId: value.metadata?.phone_number_id != null
          ? String(value.metadata.phone_number_id)
          : null,
        messageCount: Array.isArray(value.messages) ? value.messages.length : 0,
        statusCount: Array.isArray(value.statuses) ? value.statuses.length : 0,
        messageTypes: Array.isArray(value.messages)
          ? value.messages.map((msg) => pickMessageType(msg))
          : [],
        statusTypes: Array.isArray(value.statuses)
          ? value.statuses.map((status) => pickStatusType(status))
          : [],
      };
      events.push(event);
    }
  }

  return {
    object,
    entryCount: entries.length,
    events,
  };
}

/**
 * Classify webhook events for future processors (messages vs delivery status).
 * @returns {{ messages: object[], statuses: object[] }}
 */
function classifyWhatsAppWebhookEvents(body = {}) {
  const messages = [];
  const statuses = [];

  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const wabaId = entry?.id != null ? String(entry.id) : null;
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const field = change?.field != null ? String(change.field) : null;
      const value = change?.value && typeof change.value === 'object' ? change.value : {};
      const phoneNumberId = value.metadata?.phone_number_id != null
        ? String(value.metadata.phone_number_id)
        : null;

      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          messages.push({
            wabaId,
            field,
            phoneNumberId,
            messageId: message?.id != null ? String(message.id) : null,
            type: pickMessageType(message),
            timestamp: message?.timestamp != null ? String(message.timestamp) : null,
          });
        }
      }

      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          statuses.push({
            wabaId,
            field,
            phoneNumberId,
            messageId: status?.id != null ? String(status.id) : null,
            status: pickStatusType(status),
            timestamp: status?.timestamp != null ? String(status.timestamp) : null,
          });
        }
      }
    }
  }

  return { messages, statuses };
}

/**
 * Meta webhook subscription verification (GET hub.* query params).
 */
function validateWhatsAppWebhookSubscription({
  mode,
  verifyToken,
  challenge,
  expectedVerifyToken,
}) {
  const expected = String(expectedVerifyToken || '').trim();
  if (!expected) {
    return { ok: false, reason: 'missing_verify_token_config' };
  }

  if (
    mode === 'subscribe'
    && verifyToken === expected
    && challenge != null
    && String(challenge).length > 0
  ) {
    return { ok: true, challenge: String(challenge) };
  }

  return { ok: false, reason: 'verification_failed' };
}

module.exports = {
  summarizeWhatsAppWebhook,
  classifyWhatsAppWebhookEvents,
  validateWhatsAppWebhookSubscription,
};
