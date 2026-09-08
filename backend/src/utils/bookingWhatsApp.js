const User = require('../model/usermodel');
const { sendTemplateMessage, normalizeWhatsAppTo } = require('../services/whatsappService');

const DEFAULT_BOOKING_HEADER_IMAGE = 'https://www.crwdctrl.in/logo-crwdctrl.png';
const PHONE_KEY_RE = /^(phone|mobile|whatsapp|contact|phone_number|phonenumber|mobile_number)$/i;

function pickPhoneFromObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const entries = obj instanceof Map ? [...obj.entries()] : Object.entries(obj);
  for (const [key, raw] of entries) {
    const k = String(key || '');
    if (!PHONE_KEY_RE.test(k) && !/phone|mobile|whatsapp/i.test(k)) continue;
    if (/emergency|parent|alt|guardian|relative/i.test(k)) continue;
    const normalized = normalizeWhatsAppTo(raw);
    if (normalized) return normalized;
  }
  return null;
}

function resolveBookingPhone({ user, formData, responses, phone } = {}) {
  const direct = normalizeWhatsAppTo(phone)
    || normalizeWhatsAppTo(user?.phoneNumber)
    || normalizeWhatsAppTo(user?.phone);
  if (direct) return direct;
  return pickPhoneFromObject(formData) || pickPhoneFromObject(responses);
}

function formatAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `INR ${Math.round(n)}`;
}

function formatDate(value) {
  if (!value) return 'TBD';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  }
  const s = String(value).trim();
  return s || 'TBD';
}

function formatTime(value) {
  if (!value) return 'TBD';
  const s = String(value).trim();
  return s || 'TBD';
}

function buildBookingPathSuffix({ bookingId, type = '', accessToken = '' } = {}) {
  const id = String(bookingId || '').trim();
  if (!id) return '';
  const params = new URLSearchParams();
  if (type) params.set('type', String(type));
  if (accessToken) params.set('access', String(accessToken));
  const qs = params.toString();
  return qs ? `${id}?${qs}` : id;
}

/**
 * Send booking_confirmed WhatsApp (fire-and-forget safe).
 * Template vars: name, event, date, time, amount + URL button suffix.
 */
async function sendBookingConfirmedWhatsApp({
  phone,
  user,
  formData,
  responses,
  name,
  eventName,
  bookingId,
  type = '',
  date = '',
  time = '',
  amount = 0,
  accessToken = '',
} = {}) {
  try {
    const to = resolveBookingPhone({ user, formData, responses, phone });
    if (!to) {
      console.log('[whatsapp] booking confirmed skipped', {
        reason: 'no_phone',
        bookingId: bookingId ? String(bookingId) : null,
      });
      return { success: false, skipped: true, error: 'no_phone' };
    }

    const templateName = String(
      process.env.WHATSAPP_TEMPLATE_CONFIRMED || 'booking_confirmed_v2'
    ).trim();
    if (!templateName) {
      return { success: false, skipped: true, error: 'missing_template' };
    }

    const language = String(process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim();
    const headerImage = String(
      process.env.WHATSAPP_BOOKING_HEADER_IMAGE
        || process.env.WHATSAPP_WELCOME_HEADER_IMAGE
        || DEFAULT_BOOKING_HEADER_IMAGE
    ).trim();

    const displayName = String(name || user?.name || 'there').trim().slice(0, 60) || 'there';
    const event = String(eventName || 'your event').trim().slice(0, 60) || 'your event';
    const pathSuffix = buildBookingPathSuffix({ bookingId, type, accessToken });
    if (!pathSuffix) {
      return { success: false, skipped: true, error: 'missing_booking_id' };
    }

    const components = [];
    if (headerImage) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: headerImage } }],
      });
    }
    components.push({
      type: 'body',
      parameters: [
        { type: 'text', text: displayName },
        { type: 'text', text: event },
        { type: 'text', text: formatDate(date) },
        { type: 'text', text: formatTime(time) },
        { type: 'text', text: formatAmount(amount) },
      ],
    });
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: pathSuffix }],
    });

    console.log('[whatsapp] booking confirmed attempting', {
      bookingId: String(bookingId),
      type: type || null,
      toLast4: to.slice(-4),
      templateName,
    });

    return sendTemplateMessage({
      to,
      templateName,
      languageCode: language,
      components,
    });
  } catch (err) {
    console.error('[whatsapp] booking confirmed error:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendBookingConfirmedWhatsAppForUserId(userId, payload = {}) {
  if (!userId) {
    return sendBookingConfirmedWhatsApp(payload);
  }
  try {
    const user = await User.findById(userId).select('name phoneNumber phone').lean();
    return sendBookingConfirmedWhatsApp({
      ...payload,
      user: user || payload.user,
      name: payload.name || user?.name,
    });
  } catch (err) {
    console.error('[whatsapp] booking user lookup error:', err.message);
    return sendBookingConfirmedWhatsApp(payload);
  }
}

function scheduleBookingConfirmedWhatsApp(payload = {}) {
  setImmediate(() => {
    const run = payload.userId && !payload.phone && !payload.user?.phoneNumber
      ? sendBookingConfirmedWhatsAppForUserId(payload.userId, payload)
      : sendBookingConfirmedWhatsApp(payload);
    Promise.resolve(run).catch((err) => {
      console.error('[whatsapp] booking schedule error:', err.message);
    });
  });
}

module.exports = {
  resolveBookingPhone,
  buildBookingPathSuffix,
  sendBookingConfirmedWhatsApp,
  sendBookingConfirmedWhatsAppForUserId,
  scheduleBookingConfirmedWhatsApp,
};
