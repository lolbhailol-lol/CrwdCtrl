/**
 * Multi-channel dispatch for Super Admin Notification Center campaigns.
 */
const User = require('../model/usermodel');
const { createNotification } = require('../controllers/notificationController');
const { sendPushNotification } = require('./pushService');
const { sendAdminCampaignEmails } = require('./emailService');

const BATCH_SIZE = 40;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeChannels(channels = []) {
  const allowed = new Set(['inApp', 'push', 'email']);
  const list = (Array.isArray(channels) ? channels : [])
    .map((c) => String(c).trim())
    .filter((c) => allowed.has(c));
  return list.length ? [...new Set(list)] : ['inApp'];
}

function normalizeLink(link) {
  const raw = String(link || '').trim();
  if (!raw) return '';
  // Block protocol-relative URLs
  if (raw.startsWith('//')) return '';
  if (raw.startsWith('/')) return raw;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const site = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
    if (!site) return '';
    const allowed = new URL(site);
    if (parsed.origin !== allowed.origin) return '';
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  } catch {
    return `/${raw.replace(/^\/+/, '')}`;
  }
}

/**
 * Notify a single user (or email-only guest) across selected channels.
 * @param {object} opts
 * @param {object|null} opts.user - lean User doc (optional if emailOnlyTo set)
 * @param {string} [opts.emailOnlyTo] - send email when no user account
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} opts.link
 * @param {string[]} opts.channels
 * @param {object} [opts.metadata]
 */
async function notifyOneUser({
  user = null,
  emailOnlyTo = '',
  title,
  message,
  link = '',
  channels = ['inApp'],
  metadata = {},
  eventContext = null,
}) {
  const channelList = normalizeChannels(channels);
  const wantInApp = channelList.includes('inApp');
  const wantPush = channelList.includes('push');
  const wantEmail = channelList.includes('email');
  const cleanLink = normalizeLink(link || eventContext?.ctaPath || '');
  const prefs = user?.notificationPreferences || {};

  const result = {
    inApp: false,
    push: false,
    email: false,
    skippedPrefs: 0,
    failed: 0,
  };

  if (user && wantInApp) {
    try {
      const created = await createNotification({
        userId: user._id,
        title,
        message,
        type: 'announcement',
        link: cleanLink || null,
        metadata,
      });
      if (created) result.inApp = true;
      else result.failed += 1;
    } catch {
      result.failed += 1;
    }
  }

  if (user && wantPush) {
    if (prefs.pushReminders === false) {
      result.skippedPrefs += 1;
    } else if (Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
      try {
        const pushResult = await sendPushNotification(
          user._id,
          { title, body: message, link: cleanLink || '/', type: 'announcement' },
          { preferenceKey: 'pushReminders' },
        );
        if (pushResult?.success) result.push = true;
        else if (pushResult?.reason === 'preference_disabled') result.skippedPrefs += 1;
      } catch {
        result.failed += 1;
      }
    }
  }

  if (wantEmail) {
    const emailAddr = user?.email
      ? String(user.email).trim().toLowerCase()
      : String(emailOnlyTo || '').trim().toLowerCase();

    if (user && prefs.emailReminders === false) {
      result.skippedPrefs += 1;
    } else if (emailAddr && EMAIL_REGEX.test(emailAddr)) {
      const emailResult = await sendAdminCampaignEmails([
        {
          email: emailAddr,
          name: user?.name || 'there',
          title,
          message,
          link: cleanLink || '/',
          subject: title,
          eventContext: eventContext || null,
        },
      ]);
      if (emailResult.success > 0) result.email = true;
      else result.failed += emailResult.failed || 1;
    }
  }

  return result;
}

/**
 * Dispatch a campaign to resolved userIds. Updates campaign stats/status in place.
 */
async function dispatchCampaign({ campaign, userIds = [], eventContext = null }) {
  const channels = normalizeChannels(campaign.channels);
  const title = String(campaign.title || '').trim();
  const message = String(campaign.message || '').trim();
  const link = normalizeLink(campaign.link || eventContext?.ctaPath || '');
  const ctx = eventContext || campaign.eventContext || null;

  const stats = {
    targeted: userIds.length,
    inApp: 0,
    push: 0,
    email: 0,
    skippedPrefs: 0,
    failed: 0,
  };

  campaign.status = 'sending';
  campaign.stats = stats;
  if (ctx) campaign.eventContext = ctx;
  await campaign.save();

  try {
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batchIds = userIds.slice(i, i + BATCH_SIZE);
      const users = await User.find({ _id: { $in: batchIds }, isDeleted: { $ne: true } })
        .select('name email fcmTokens notificationPreferences')
        .lean();

      for (const user of users) {
        const one = await notifyOneUser({
          user,
          title,
          message,
          link,
          channels,
          eventContext: ctx,
          metadata: {
            source: 'admin_campaign',
            campaignId: String(campaign._id),
          },
        });
        if (one.inApp) stats.inApp += 1;
        if (one.push) stats.push += 1;
        if (one.email) stats.email += 1;
        stats.skippedPrefs += one.skippedPrefs || 0;
        stats.failed += one.failed || 0;
      }

      campaign.stats = { ...stats };
      await campaign.save();
    }

    campaign.status = 'completed';
    campaign.completedAt = new Date();
    campaign.stats = stats;
    await campaign.save();
    return { campaign, stats };
  } catch (err) {
    campaign.status = 'failed';
    campaign.errorMessage = err.message || 'Dispatch failed';
    campaign.completedAt = new Date();
    campaign.stats = stats;
    await campaign.save();
    throw err;
  }
}

module.exports = {
  notifyOneUser,
  dispatchCampaign,
  normalizeChannels,
  normalizeLink,
};
