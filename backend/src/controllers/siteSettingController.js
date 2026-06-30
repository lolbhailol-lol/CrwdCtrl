const SiteSetting = require('../model/site_setting_model');

const HOME_SECTION_LABELS_KEY = 'home_section_labels';

/** Default copy for the fixed home carousels (used as fallback everywhere). */
const DEFAULT_HOME_SECTION_LABELS = {
    ongoing: 'Ongoing Events',
    happening: 'Happening near you',
};

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
