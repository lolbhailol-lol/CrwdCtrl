const User = require('../model/usermodel');
const { sendTemplateMessage, normalizeWhatsAppTo } = require('../services/whatsappService');

const DEFAULT_WELCOME_HEADER_IMAGE = 'https://www.crwdctrl.in/logo-crwdctrl.png';

/**
 * Fire-and-forget welcome WhatsApp (once per user).
 * Safe to call from register / social signup / login.
 */
async function maybeSendWelcomeWhatsApp(user) {
  try {
    if (!user?._id) {
      return { success: false, skipped: true, error: 'missing_user' };
    }

    if (user.welcomeWhatsAppSentAt) {
      console.log('[whatsapp] welcome skipped', { reason: 'already_sent', userId: String(user._id) });
      return { success: false, skipped: true, error: 'already_sent' };
    }

    const phone = normalizeWhatsAppTo(user.phoneNumber || user.phone);
    if (!phone) {
      console.log('[whatsapp] welcome skipped', { reason: 'no_phone', userId: String(user._id) });
      return { success: false, skipped: true, error: 'no_phone' };
    }

    const name = String(user.name || 'there').trim().slice(0, 60) || 'there';
    const templateName = String(
      process.env.WHATSAPP_TEMPLATE_WELCOME || 'welcome_crwdctrl'
    ).trim();
    const language = String(
      process.env.WHATSAPP_TEMPLATE_WELCOME_LANG
        || process.env.WHATSAPP_TEMPLATE_LANG
        || 'en'
    ).trim();
    const headerImage = String(
      process.env.WHATSAPP_WELCOME_HEADER_IMAGE || DEFAULT_WELCOME_HEADER_IMAGE
    ).trim();

    const components = [];
    if (headerImage) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: headerImage } }],
      });
    }
    components.push({
      type: 'body',
      parameters: [{ type: 'text', text: name }],
    });

    console.log('[whatsapp] welcome attempting', {
      userId: String(user._id),
      toLast4: phone.slice(-4),
      templateName,
    });

    const result = await sendTemplateMessage({
      to: phone,
      templateName,
      languageCode: language,
      components,
    });

    if (result.skipped) {
      console.log('[whatsapp] welcome skipped', {
        reason: result.error || 'skipped',
        userId: String(user._id),
        toLast4: phone.slice(-4),
      });
    }

    if (result.success) {
      // Don't permanently mark as sent in mock mode so local retests still fire.
      if (!result.mock) {
        await User.updateOne(
          {
            _id: user._id,
            $or: [
              { welcomeWhatsAppSentAt: { $exists: false } },
              { welcomeWhatsAppSentAt: null },
            ],
          },
          { $set: { welcomeWhatsAppSentAt: new Date() } }
        );
      }
    }

    return result;
  } catch (err) {
    console.error('[whatsapp] welcome send error:', err.message);
    return { success: false, error: err.message };
  }
}

function scheduleWelcomeWhatsApp(user) {
  if (!user?._id) return;
  setImmediate(() => {
    maybeSendWelcomeWhatsApp(user).catch((err) => {
      console.error('[whatsapp] welcome schedule error:', err.message);
    });
  });
}

module.exports = {
  maybeSendWelcomeWhatsApp,
  scheduleWelcomeWhatsApp,
};
