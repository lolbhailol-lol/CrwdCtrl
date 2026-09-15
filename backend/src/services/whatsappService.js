/**
 * Meta WhatsApp Cloud API client.
 * Soft-fails by default — never throw into HTTP request handlers.
 */

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

function isWhatsAppEnabled() {
  if (String(process.env.WHATSAPP_ENABLED || '').toLowerCase() !== 'true') {
    return false;
  }
  const token = String(process.env.WHATSAPP_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  return Boolean(token && phoneNumberId);
}

function isWhatsAppMockMode() {
  return String(process.env.WHATSAPP_MOCK_MODE || '').toLowerCase() === 'true';
}

/**
 * Normalize to digits-only E.164 without '+'.
 * Default India (+91) for bare 10-digit numbers.
 */
function normalizeWhatsAppTo(phone) {
  if (phone == null) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) {
    digits = `91${digits.slice(1)}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/**
 * Send a WhatsApp Cloud API template message.
 * @returns {Promise<{ success: boolean, skipped?: boolean, mock?: boolean, messageId?: string, error?: string }>}
 */
async function sendTemplateMessage({
  to,
  templateName,
  languageCode,
  components = [],
}) {
  const normalizedTo = normalizeWhatsAppTo(to);
  if (!normalizedTo) {
    return { success: false, skipped: true, error: 'invalid_phone' };
  }

  const name = String(templateName || '').trim();
  const language = String(languageCode || process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim();
  if (!name) {
    return { success: false, skipped: true, error: 'missing_template_name' };
  }

  if (isWhatsAppMockMode()) {
    console.log('[whatsapp] mock send', {
      toLast4: normalizedTo.slice(-4),
      templateName: name,
      language,
      componentCount: Array.isArray(components) ? components.length : 0,
    });
    return { success: true, mock: true };
  }

  if (!isWhatsAppEnabled()) {
    return { success: false, skipped: true, error: 'whatsapp_disabled' };
  }

  const token = String(process.env.WHATSAPP_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'template',
    template: {
      name,
      language: { code: language },
    },
  };
  if (Array.isArray(components) && components.length > 0) {
    payload.template.components = components;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.error?.message || `http_${res.status}`;
      console.error('[whatsapp] send failed', {
        status: res.status,
        code: data?.error?.code,
        message: errMsg,
        templateName: name,
        toLast4: normalizedTo.slice(-4),
      });
      return { success: false, error: errMsg };
    }

    const messageId = data?.messages?.[0]?.id || null;
    console.log('[whatsapp] sent', {
      templateName: name,
      toLast4: normalizedTo.slice(-4),
      messageId,
    });
    return { success: true, messageId };
  } catch (err) {
    console.error('[whatsapp] send error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  isWhatsAppEnabled,
  isWhatsAppMockMode,
  normalizeWhatsAppTo,
  sendTemplateMessage,
};
