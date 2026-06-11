const HomepageSection = require('../model/homepage_section_model');
const { TARGET_PAGES } = require('../model/homepage_section_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const TrekCommunity = require('../model/trek_community_model');
const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');

const ENTITY_MODELS = [FestOrganizer, Trek, TrekCommunity, SportsEvent, RunClub];

function slugify(title) {
    const base = String(title || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return base ? `custom-${base}` : `custom-section-${Date.now()}`;
}

function clearCaches() {
    try {
        const { clearAllCaches } = require('./festOrganizerController');
        clearAllCaches();
    } catch (_) { /* optional */ }
}

async function clearEntitySectionAssignments(targetPage, slug) {
    if (targetPage === 'home') {
        await Promise.all(
            ENTITY_MODELS.map((Model) =>
                Model.updateMany({ homeSection: slug }, { $set: { homeSection: null } }),
            ),
        );
        return;
    }

    await Promise.all(
        ENTITY_MODELS.map((Model) =>
            Model.updateMany(
                { 'customPageSections.sectionSlug': slug, 'customPageSections.page': targetPage },
                { $pull: { customPageSections: { page: targetPage, sectionSlug: slug } } },
            ),
        ),
    );
}

function buildPublicQuery(req) {
    const query = { enabled: true };
    const page = req.query.page;
    if (page && TARGET_PAGES.includes(page)) {
        query.targetPage = page;
    }
    return query;
}

/** GET /page-sections or /homepage-sections — public list of enabled sections */
exports.listPublic = async (req, res) => {
    try {
        const sections = await HomepageSection.find(buildPublicQuery(req))
            .sort({ displayOrder: 1, createdAt: 1 })
            .select('slug title cardSize displayOrder targetPage')
            .lean();
        res.json({ sections });
    } catch (error) {
        console.error('listPublic page sections error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch page sections' });
    }
};

/** GET /admin/homepage-sections */
exports.listAdmin = async (req, res) => {
    try {
        const query = {};
        const page = req.query.page;
        if (page && TARGET_PAGES.includes(page)) {
            query.targetPage = page;
        }

        const sections = await HomepageSection.find(query)
            .sort({ targetPage: 1, displayOrder: 1, createdAt: 1 })
            .lean();
        res.json({ sections });
    } catch (error) {
        console.error('listAdmin page sections error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch page sections' });
    }
};

/** POST /admin/homepage-sections */
exports.create = async (req, res) => {
    try {
        const { title, cardSize = 'wide', enabled = true, targetPage = 'home' } = req.body;
        if (!title?.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }
        if (!TARGET_PAGES.includes(targetPage)) {
            return res.status(400).json({ success: false, message: 'Invalid target page' });
        }

        let slug = slugify(title);
        const existing = await HomepageSection.findOne({ targetPage, slug }).lean();
        if (existing) slug = `${slug}-${Date.now().toString(36)}`;

        const maxOrder = await HomepageSection.findOne({ targetPage })
            .sort({ displayOrder: -1 })
            .select('displayOrder')
            .lean();
        const displayOrder = (maxOrder?.displayOrder || 0) + 1;

        const section = await HomepageSection.create({
            slug,
            title: title.trim(),
            targetPage,
            cardSize,
            enabled: Boolean(enabled),
            displayOrder,
        });

        clearCaches();
        res.status(201).json({ section });
    } catch (error) {
        console.error('create page section error:', error);
        res.status(500).json({ success: false, message: 'Failed to create page section' });
    }
};

/** PUT /admin/homepage-sections/:id */
exports.update = async (req, res) => {
    try {
        const { title, cardSize, enabled, displayOrder } = req.body;
        const updates = {};
        if (title !== undefined) {
            if (!String(title).trim()) {
                return res.status(400).json({ success: false, message: 'Title cannot be empty' });
            }
            updates.title = String(title).trim();
        }
        if (cardSize !== undefined) updates.cardSize = cardSize;
        if (enabled !== undefined) updates.enabled = Boolean(enabled);
        if (displayOrder !== undefined) updates.displayOrder = Math.max(1, Math.min(999, Number(displayOrder) || 999));

        const section = await HomepageSection.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true },
        );
        if (!section) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        clearCaches();
        res.json({ section });
    } catch (error) {
        console.error('update page section error:', error);
        res.status(500).json({ success: false, message: 'Failed to update page section' });
    }
};

/** DELETE /admin/homepage-sections/:id */
exports.remove = async (req, res) => {
    try {
        const section = await HomepageSection.findByIdAndDelete(req.params.id);
        if (!section) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        await clearEntitySectionAssignments(section.targetPage, section.slug);
        clearCaches();
        res.json({ success: true });
    } catch (error) {
        console.error('delete page section error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete page section' });
    }
};

/** POST /admin/homepage-sections/reorder — body: { orderedIds: [id, ...], targetPage? } */
exports.reorder = async (req, res) => {
    try {
        const { orderedIds } = req.body;
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            return res.status(400).json({ success: false, message: 'orderedIds must be a non-empty array' });
        }

        const ops = orderedIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { $set: { displayOrder: index + 1 } },
            },
        }));

        await HomepageSection.bulkWrite(ops);
        clearCaches();
        res.json({ success: true });
    } catch (error) {
        console.error('reorder page sections error:', error);
        res.status(500).json({ success: false, message: 'Failed to reorder page sections' });
    }
};
