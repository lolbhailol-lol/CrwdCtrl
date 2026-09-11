const SiteSetting = require('../model/site_setting_model');
const {
    setHomeHeroSlide,
    setHomeFeaturedExperience,
    clearAllHomeHeroSlides,
} = require('../utils/featuredPlacement');
const {
    DEFAULT_HOME_SECTION_LABELS,
    DEFAULT_HUB_SECTION_LABELS,
    DEFAULT_EMPTY_STATES,
    DEFAULT_ANNOUNCEMENT,
    buildPublicConfig,
    normalizeAppCopyWrite,
} = require('../utils/publicAppConfig');

const HOME_SECTION_LABELS_KEY = 'home_section_labels';
const HOME_FEATURED_SLOTS_KEY = 'home_featured_slots';
const HUB_SECTION_LABELS_KEY = 'hub_section_labels';
const ANNOUNCEMENT_BANNER_KEY = 'announcement_banner';
const EMPTY_STATES_KEY = 'empty_states';

/** Read stored labels merged over the defaults. Never throws. */
async function readHomeSectionLabels() {
    try {
        const doc = await SiteSetting.findOne({ key: HOME_SECTION_LABELS_KEY }).lean();
        const stored = doc && doc.value && typeof doc.value === 'object' ? doc.value : {};
        return { ...DEFAULT_HOME_SECTION_LABELS, ...stored };
    } catch (_) {
        return { ...DEFAULT_HOME_SECTION_LABELS };
    }
}

exports.DEFAULT_HOME_SECTION_LABELS = DEFAULT_HOME_SECTION_LABELS;
exports.readHomeSectionLabels = readHomeSectionLabels;

const DEFAULT_HOME_FEATURED_SLOTS = {
    heroBanner: null,
    featuredExperience: null,
};

function normalizeFeaturedSlot(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const entityType = String(raw.entityType || '').trim();
    const entityId = String(raw.entityId || '').trim();
    if (!entityType || !entityId) return null;
    return { entityType, entityId };
}

/** Read stored home featured slots. Never throws. */
async function readHomeFeaturedSlots() {
    try {
        const doc = await SiteSetting.findOne({ key: HOME_FEATURED_SLOTS_KEY }).lean();
        const stored = doc && doc.value && typeof doc.value === 'object' ? doc.value : {};
        return {
            heroBanner: normalizeFeaturedSlot(stored.heroBanner),
            featuredExperience: normalizeFeaturedSlot(stored.featuredExperience),
        };
    } catch (_) {
        return { ...DEFAULT_HOME_FEATURED_SLOTS };
    }
}

exports.readHomeFeaturedSlots = readHomeFeaturedSlots;

// GET /api/home/section-labels (public) | GET /api/admin/site-settings/home-section-labels (admin)
exports.getHomeSectionLabels = async (_req, res) => {
    const labels = await readHomeSectionLabels();
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ success: true, labels });
};

// PUT /api/admin/site-settings/home-section-labels (admin)
exports.updateHomeSectionLabels = async (req, res) => {
    try {
        const incoming = req.body && typeof req.body === 'object'
            ? (req.body.labels && typeof req.body.labels === 'object' ? req.body.labels : req.body)
            : {};
        const clean = {};
        for (const key of Object.keys(DEFAULT_HOME_SECTION_LABELS)) {
            if (typeof incoming[key] === 'string') {
                const trimmed = incoming[key].trim();
                if (trimmed) clean[key] = trimmed;
            }
        }
        const doc = await SiteSetting.findOneAndUpdate(
            { key: HOME_SECTION_LABELS_KEY },
            { $set: { value: clean } },
            { new: true, upsert: true }
        );
        const stored = doc && doc.value && typeof doc.value === 'object' ? doc.value : {};
        res.json({ success: true, labels: { ...DEFAULT_HOME_SECTION_LABELS, ...stored } });
    } catch (err) {
        console.error('[SiteSetting] updateHomeSectionLabels error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update labels', error: err.message });
    }
};

// GET /api/admin/site-settings/home-featured-slots (admin)
exports.getHomeFeaturedSlots = async (_req, res) => {
    const slots = await readHomeFeaturedSlots();
    res.json({ success: true, slots });
};

// PUT /api/admin/site-settings/home-featured-slots (admin)
exports.updateHomeFeaturedSlots = async (req, res) => {
    try {
        const incoming = req.body?.slots && typeof req.body.slots === 'object' ? req.body.slots : req.body;
        const prev = await readHomeFeaturedSlots();

        // Hero banner is managed in Assign (showOnHomeSlide). Only touch it when explicitly sent.
        const hasHeroKey = Object.prototype.hasOwnProperty.call(incoming, 'heroBanner');
        let heroBanner = prev.heroBanner || null;
        if (hasHeroKey) {
            heroBanner = incoming.heroBanner === null
                ? null
                : normalizeFeaturedSlot(incoming.heroBanner);
            if (heroBanner === null) {
                await clearAllHomeHeroSlides();
            } else {
                await setHomeHeroSlide(heroBanner.entityType, heroBanner.entityId);
            }
        }

        const hasFeaturedKey = Object.prototype.hasOwnProperty.call(incoming, 'featuredExperience');
        let featuredExperience = prev.featuredExperience || null;
        if (hasFeaturedKey) {
            featuredExperience = incoming.featuredExperience === null
                ? null
                : normalizeFeaturedSlot(incoming.featuredExperience);
            if (featuredExperience) {
                await setHomeFeaturedExperience(featuredExperience.entityType, featuredExperience.entityId);
            }
        }

        const value = { heroBanner, featuredExperience };
        await SiteSetting.findOneAndUpdate(
            { key: HOME_FEATURED_SLOTS_KEY },
            { $set: { value } },
            { new: true, upsert: true },
        );

        try {
            const { clearAllCaches } = require('./festOrganizerController');
            clearAllCaches();
        } catch (_) { /* optional */ }

        res.json({ success: true, slots: value });
    } catch (err) {
        console.error('[SiteSetting] updateHomeFeaturedSlots error:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Failed to update featured slots' });
    }
};

async function readSettingValue(key, fallback) {
    try {
        const doc = await SiteSetting.findOne({ key }).lean();
        const stored = doc && doc.value && typeof doc.value === 'object' ? doc.value : {};
        return stored;
    } catch (_) {
        return fallback && typeof fallback === 'object' ? { ...fallback } : {};
    }
}

/** Assemble the public client config. Never throws. Never includes secrets. */
async function readPublicConfig() {
    const [homeLabels, hubLabels, emptyStates, announcement] = await Promise.all([
        readHomeSectionLabels(),
        readSettingValue(HUB_SECTION_LABELS_KEY, DEFAULT_HUB_SECTION_LABELS),
        readSettingValue(EMPTY_STATES_KEY, DEFAULT_EMPTY_STATES),
        readSettingValue(ANNOUNCEMENT_BANNER_KEY, DEFAULT_ANNOUNCEMENT),
    ]);
    return buildPublicConfig({ homeLabels, hubLabels, emptyStates, announcement });
}

exports.readPublicConfig = readPublicConfig;

function clearContentCaches() {
    try {
        const { clearAllCaches } = require('./festOrganizerController');
        clearAllCaches();
    } catch (_) { /* optional */ }
}

// GET /api/config/public
exports.getPublicConfig = async (_req, res) => {
    const config = await readPublicConfig();
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json({ success: true, config });
};

// GET /api/admin/site-settings/app-copy
exports.getAppCopy = async (_req, res) => {
    const config = await readPublicConfig();
    res.json({ success: true, config });
};

// PUT /api/admin/site-settings/app-copy
exports.updateAppCopy = async (req, res) => {
    try {
        const incoming = req.body?.config && typeof req.body.config === 'object'
            ? req.body.config
            : req.body;
        const clean = normalizeAppCopyWrite(incoming);

        await Promise.all([
            SiteSetting.findOneAndUpdate(
                { key: HOME_SECTION_LABELS_KEY },
                { $set: { value: clean.homeLabels } },
                { upsert: true },
            ),
            SiteSetting.findOneAndUpdate(
                { key: HUB_SECTION_LABELS_KEY },
                { $set: { value: clean.hubLabels } },
                { upsert: true },
            ),
            SiteSetting.findOneAndUpdate(
                { key: EMPTY_STATES_KEY },
                { $set: { value: clean.emptyStates } },
                { upsert: true },
            ),
            SiteSetting.findOneAndUpdate(
                { key: ANNOUNCEMENT_BANNER_KEY },
                { $set: { value: clean.announcement } },
                { upsert: true },
            ),
        ]);

        clearContentCaches();
        const config = await readPublicConfig();
        res.json({ success: true, config });
    } catch (err) {
        console.error('[SiteSetting] updateAppCopy error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update app copy' });
    }
};
