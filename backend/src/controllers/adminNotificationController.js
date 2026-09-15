const User = require('../model/usermodel');
const NotificationCampaign = require('../model/notification_campaign_model');
const AudiencePreset = require('../model/audience_preset_model');
const {
  buildAudiencePreview,
  getAudienceOptions,
  resolveUserIdsFromAudience,
  describeAudience,
  MAX_AUDIENCE,
} = require('../services/adminAudienceService');
const {
  dispatchCampaign,
  notifyOneUser,
  normalizeChannels,
  normalizeLink,
} = require('../services/adminNotificationDispatch');
const {
  resolveEventCardFromAudience,
  resolveEventContext,
  audienceFromQuery,
} = require('../services/adminEventCardService');
const { previewAdminCampaignEmailHTML } = require('../services/emailService');

function normalizeAbout(about) {
  if (!about || typeof about !== 'object') return null;
  const kind = String(about.kind || '').trim();
  const id = String(about.id || '').trim();
  if (!kind || !id) return null;
  return { kind, id };
}

function resolveContextFromBody(body = {}) {
  const aboutPresent = Object.prototype.hasOwnProperty.call(body, 'about');
  const aboutNorm = normalizeAbout(body.about);
  return {
    aboutPresent,
    aboutNorm,
    resolve: () =>
      resolveEventContext({
        about: aboutNorm,
        audience: body.audience,
        aboutPresent,
      }),
  };
}

const SYSTEM_PRESETS = [
  {
    name: 'Fashion competition participants',
    description: 'All users registered for fashion competitions (pending + approved)',
    audience: {
      type: 'competition_type',
      filters: { competitionType: 'fashion', status: 'all' },
      label: 'Fashion competition participants',
    },
    isSystem: true,
  },
  {
    name: 'All verified users',
    description: 'Every verified CrwdCtrl account',
    audience: {
      type: 'all_users',
      filters: { verifiedOnly: true },
      label: 'All verified users',
    },
    isSystem: true,
  },
];

async function ensureSystemPresets() {
  for (const preset of SYSTEM_PRESETS) {
    const exists = await AudiencePreset.findOne({ name: preset.name, isSystem: true }).lean();
    if (!exists) {
      await AudiencePreset.create({ ...preset, createdBy: 'system' });
    }
  }
}

function adminIdentity(req) {
  return req.user?.email || req.user?.userId || req.user?.id || 'admin';
}

/**
 * Mark campaigns stuck in "sending" after restart/crash as failed.
 * @param {number} olderThanMinutes
 */
async function recoverStuckCampaigns(olderThanMinutes = 30) {
  const minutes = Math.max(5, Number(olderThanMinutes) || 30);
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const result = await NotificationCampaign.updateMany(
    { status: 'sending', updatedAt: { $lt: cutoff } },
    {
      $set: {
        status: 'failed',
        errorMessage: 'Interrupted (server restart or timeout)',
        completedAt: new Date(),
      },
    },
  );
  return result.modifiedCount || 0;
}

// GET /api/admin/notifications/audiences/options
const getOptions = async (req, res) => {
  try {
    const options = await getAudienceOptions();
    res.json(options);
  } catch (err) {
    console.error('Admin notifications options error:', err);
    res.status(500).json({ error: 'Failed to load audience options' });
  }
};

// GET /api/admin/notifications/event-card
const getEventCard = async (req, res) => {
  try {
    const audience = audienceFromQuery(req.query);
    if (!audience.type) {
      return res.status(400).json({ error: 'type is required' });
    }
    const card = await resolveEventCardFromAudience(audience);
    res.json({ eventCard: card });
  } catch (err) {
    console.error('Admin notifications event-card error:', err);
    res.status(500).json({ error: 'Failed to load event card' });
  }
};

// POST /api/admin/notifications/preview-email
const previewEmail = async (req, res) => {
  try {
    const body = req.body || {};
    const { title, message, link, name } = body;
    const cleanTitle = String(title || '').trim() || 'Update from CrwdCtrl';
    const cleanMessage = String(message || '').trim() || 'Your message will appear here.';
    const { resolve } = resolveContextFromBody(body);
    const eventContext = await resolve();
    const html = previewAdminCampaignEmailHTML({
      name: name || 'there',
      title: cleanTitle,
      message: cleanMessage,
      link: normalizeLink(link || eventContext?.ctaPath || '/'),
      eventContext,
    });
    res.json({ html, eventCard: eventContext });
  } catch (err) {
    console.error('Admin notifications preview-email error:', err);
    res.status(500).json({ error: 'Failed to preview email' });
  }
};

// POST /api/admin/notifications/preview
const previewAudience = async (req, res) => {
  try {
    const audience = req.body?.audience || req.body || {};
    if (!audience.type) {
      return res.status(400).json({ error: 'audience.type is required' });
    }
    const preview = await buildAudiencePreview(audience);
    res.json({
      ...preview,
      label: describeAudience(audience),
      maxAudience: MAX_AUDIENCE,
    });
  } catch (err) {
    if (err.code === 'AUDIENCE_TOO_LARGE') {
      return res.status(400).json({
        error: err.message,
        count: err.count,
        maxAudience: MAX_AUDIENCE,
      });
    }
    console.error('Admin notifications preview error:', err);
    res.status(400).json({ error: err.message || 'Failed to preview audience' });
  }
};

// POST /api/admin/notifications/test-send
const testSend = async (req, res) => {
  let campaign = null;
  try {
    const body = req.body || {};
    const { title, message, link, channels, audience } = body;
    const cleanTitle = String(title || '').trim();
    const cleanMessage = String(message || '').trim();
    if (!cleanTitle || !cleanMessage) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    const channelList = normalizeChannels(channels);
    const adminEmail = String(req.user?.email || '').trim().toLowerCase();
    if (!adminEmail) {
      return res.status(400).json({ error: 'Admin email missing from session' });
    }

    const { aboutNorm, resolve } = resolveContextFromBody(body);
    const eventContext = await resolve();

    const user = await User.findOne({
      email: new RegExp(`^${adminEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      isDeleted: { $ne: true },
    })
      .select('name email fcmTokens notificationPreferences')
      .lean();

    campaign = await NotificationCampaign.create({
      title: cleanTitle,
      message: cleanMessage,
      link: normalizeLink(link || eventContext?.ctaPath || ''),
      channels: channelList,
      audience: {
        type: 'test',
        filters: audience?.filters || {},
        label: eventContext ? `Test · ${eventContext.name}` : 'Test send to admin',
        resolvedCount: 1,
        selectedUserIds: user ? [user._id] : [],
      },
      status: 'sending',
      isTest: true,
      about: aboutNorm || { kind: '', id: '' },
      eventContext: eventContext || null,
      createdBy: adminIdentity(req),
      stats: { targeted: 1 },
    });

    let delivery;
    let reason = '';
    const notifyOpts = {
      title: cleanTitle,
      message: cleanMessage,
      link: normalizeLink(link || eventContext?.ctaPath || ''),
      eventContext,
      metadata: {
        source: 'admin_campaign_test',
        campaignId: String(campaign._id),
      },
    };

    if (user) {
      delivery = await notifyOneUser({
        ...notifyOpts,
        user,
        channels: channelList,
      });
    } else {
      reason = 'no_user_account';
      if (channelList.includes('email')) {
        delivery = await notifyOneUser({
          ...notifyOpts,
          user: null,
          emailOnlyTo: adminEmail,
          channels: ['email'],
        });
      } else {
        delivery = { inApp: false, push: false, email: false, skippedPrefs: 0, failed: 0 };
      }
      delivery.inApp = false;
      delivery.push = false;
    }

    campaign.status = 'completed';
    campaign.completedAt = new Date();
    campaign.stats = {
      targeted: 1,
      inApp: delivery.inApp ? 1 : 0,
      push: delivery.push ? 1 : 0,
      email: delivery.email ? 1 : 0,
      skippedPrefs: delivery.skippedPrefs || 0,
      failed: delivery.failed || 0,
    };
    await campaign.save();

    res.json({
      message: reason === 'no_user_account'
        ? 'Test sent (email only — no CrwdCtrl user for admin email). In-app and push need a matching user account.'
        : 'Test notification sent',
      campaignId: campaign._id,
      status: campaign.status,
      delivery: {
        inApp: !!delivery.inApp,
        push: !!delivery.push,
        email: !!delivery.email,
        skippedPrefs: delivery.skippedPrefs || 0,
        failed: delivery.failed || 0,
      },
      reason: reason || undefined,
      channels: channelList,
      adminEmail,
      hasUserAccount: !!user,
      eventCard: eventContext,
    });
  } catch (err) {
    if (campaign && campaign.status === 'sending') {
      try {
        campaign.status = 'failed';
        campaign.errorMessage = err.message || 'Test send failed';
        campaign.completedAt = new Date();
        await campaign.save();
      } catch (saveErr) {
        console.error('Admin notifications test-send status save error:', saveErr);
      }
    }
    console.error('Admin notifications test-send error:', err);
    res.status(500).json({ error: err.message || 'Failed to send test' });
  }
};

// POST /api/admin/notifications/send
const sendCampaign = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      audience,
      title,
      message,
      link,
      channels,
      confirmLarge,
    } = body;

    if (!audience?.type) {
      return res.status(400).json({ error: 'audience.type is required' });
    }
    const cleanTitle = String(title || '').trim();
    const cleanMessage = String(message || '').trim();
    if (!cleanTitle || !cleanMessage) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    const channelList = normalizeChannels(channels);
    const userIds = await resolveUserIdsFromAudience(audience);
    const { aboutNorm, resolve } = resolveContextFromBody(body);
    const eventContext = await resolve();

    if (userIds.length === 0) {
      return res.status(400).json({ error: 'No users match this audience' });
    }
    if (userIds.length > 50 && !confirmLarge) {
      return res.status(400).json({
        error: `This will reach ${userIds.length} users. Set confirmLarge: true to proceed.`,
        count: userIds.length,
        requiresConfirm: true,
      });
    }

    const campaign = await NotificationCampaign.create({
      title: cleanTitle,
      message: cleanMessage,
      link: normalizeLink(link || eventContext?.ctaPath || ''),
      channels: channelList,
      audience: {
        type: audience.type,
        filters: audience.filters || {},
        label: describeAudience(audience),
        resolvedCount: userIds.length,
        selectedUserIds: Array.isArray(audience.selectedUserIds)
          ? audience.selectedUserIds
          : [],
      },
      status: 'sending',
      isTest: false,
      about: aboutNorm || { kind: '', id: '' },
      eventContext: eventContext || null,
      createdBy: adminIdentity(req),
      stats: { targeted: userIds.length },
    });

    const campaignId = campaign._id;
    setImmediate(() => {
      dispatchCampaign({ campaign, userIds, eventContext }).catch((err) => {
        console.error('Admin campaign background dispatch error:', campaignId, err.message);
      });
    });

    res.json({
      message: 'Campaign queued',
      campaignId,
      status: 'sending',
      channels: channelList,
      count: userIds.length,
      eventCard: eventContext,
    });
  } catch (err) {
    if (err.code === 'AUDIENCE_TOO_LARGE') {
      return res.status(400).json({
        error: err.message,
        count: err.count,
        maxAudience: MAX_AUDIENCE,
      });
    }
    if (err.code === 'INVALID_FILTER') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Admin notifications send error:', err);
    res.status(500).json({ error: err.message || 'Failed to send campaign' });
  }
};

// GET /api/admin/notifications/campaigns
const listCampaigns = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      NotificationCampaign.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationCampaign.countDocuments({}),
    ]);

    res.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('Admin notifications list campaigns error:', err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
};

// GET /api/admin/notifications/campaigns/:id
const getCampaign = async (req, res) => {
  try {
    const campaign = await NotificationCampaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign });
  } catch (err) {
    console.error('Admin notifications get campaign error:', err);
    res.status(500).json({ error: 'Failed to load campaign' });
  }
};

// GET /api/admin/notifications/presets
const listPresets = async (req, res) => {
  try {
    await ensureSystemPresets();
    const presets = await AudiencePreset.find({}).sort({ isSystem: -1, name: 1 }).lean();
    res.json({ presets });
  } catch (err) {
    console.error('Admin notifications list presets error:', err);
    res.status(500).json({ error: 'Failed to load presets' });
  }
};

// POST /api/admin/notifications/presets
const createPreset = async (req, res) => {
  try {
    const { name, description, audience } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'name is required' });
    if (!audience?.type) return res.status(400).json({ error: 'audience.type is required' });

    const preset = await AudiencePreset.create({
      name: cleanName,
      description: String(description || '').trim(),
      audience: {
        type: audience.type,
        filters: audience.filters || {},
        label: audience.label || describeAudience(audience),
      },
      isSystem: false,
      createdBy: adminIdentity(req),
    });

    res.status(201).json({ preset });
  } catch (err) {
    console.error('Admin notifications create preset error:', err);
    res.status(500).json({ error: 'Failed to save preset' });
  }
};

// DELETE /api/admin/notifications/presets/:id
const deletePreset = async (req, res) => {
  try {
    const preset = await AudiencePreset.findById(req.params.id);
    if (!preset) return res.status(404).json({ error: 'Preset not found' });
    if (preset.isSystem) {
      return res.status(400).json({ error: 'System presets cannot be deleted' });
    }
    await preset.deleteOne();
    res.json({ message: 'Preset deleted' });
  } catch (err) {
    console.error('Admin notifications delete preset error:', err);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
};

module.exports = {
  getOptions,
  getEventCard,
  previewEmail,
  previewAudience,
  testSend,
  sendCampaign,
  listCampaigns,
  getCampaign,
  listPresets,
  createPreset,
  deletePreset,
  recoverStuckCampaigns,
};
