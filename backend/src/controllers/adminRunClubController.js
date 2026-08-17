const mongoose = require('mongoose');
const RunClub = require('../model/run_club_model');
const SportsEvent = require('../model/sports_model');

const { sanitizeCoverImages, primaryCoverUrl, excludeCoverUrlsFromGallery } = require('../utils/sanitizeCoverImages');

const dbOk = () => mongoose.connection.readyState === 1;

function normalizeImageUrl(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value.url) return String(value.url).trim();
    if (typeof value === 'object' && value.secure_url) return String(value.secure_url).trim();
    return '';
}

function sanitizeRunClubBody(body = {}) {
    const payload = {};
    if (body.name !== undefined) payload.name = String(body.name).trim();
    if (body.basedIn !== undefined) payload.basedIn = String(body.basedIn || '').trim();
    if (body.tagline !== undefined) payload.tagline = String(body.tagline || '').trim();
    if (body.organizer !== undefined) payload.organizer = String(body.organizer || '').trim();
    if (body.aboutUs !== undefined) payload.aboutUs = String(body.aboutUs || '').trim();
    if (body.runCategories !== undefined) {
        payload.runCategories = Array.isArray(body.runCategories)
            ? body.runCategories.map((c) => String(c).trim()).filter(Boolean)
            : [];
    }
    if (body.coverImages !== undefined) {
        payload.coverImages = sanitizeCoverImages(body.coverImages);
        payload.coverImage = primaryCoverUrl(payload.coverImages, body.coverImage);
    } else if (body.coverImage !== undefined) {
        payload.coverImage = normalizeImageUrl(body.coverImage);
    }
    if (body.galleryImages !== undefined) {
        const covers = payload.coverImages || sanitizeCoverImages(body.coverImages);
        const legacyCover = payload.coverImage !== undefined
            ? payload.coverImage
            : normalizeImageUrl(body.coverImage);
        payload.galleryImages = excludeCoverUrlsFromGallery(body.galleryImages, covers, legacyCover);
    }
    if (body.registrationLink !== undefined) payload.registrationLink = String(body.registrationLink || '').trim();
    if (body.registration !== undefined && body.registration && typeof body.registration === 'object') {
        payload.registration = {
            status: ['open', 'closed'].includes(body.registration.status) ? body.registration.status : 'open',
            mode: ['internal_form', 'external_link'].includes(body.registration.mode) ? body.registration.mode : 'internal_form',
        };
    }
    if (body.contactPhone !== undefined) payload.contactPhone = String(body.contactPhone || '').trim();
    if (body.contactInstagram !== undefined) payload.contactInstagram = String(body.contactInstagram || '').trim();
    if (body.groupLink !== undefined) payload.groupLink = String(body.groupLink || '').trim();
    if (body.showOnSportsPage !== undefined) payload.showOnSportsPage = Boolean(body.showOnSportsPage);
    if (body.showInRunClubs !== undefined) payload.showInRunClubs = Boolean(body.showInRunClubs);
    if (body.listingHub !== undefined) {
        payload.listingHub = body.listingHub === 'events' ? 'events' : 'sports';
        if (payload.listingHub === 'events') {
            payload.showOnSportsPage = false;
            payload.showInRunClubs = false;
        }
    }
    if (body.runClubPriority !== undefined) {
        const p = parseInt(body.runClubPriority, 10);
        payload.runClubPriority = Number.isNaN(p) ? 999 : Math.max(1, Math.min(999, p));
    }
    if (body.homeSection !== undefined) {
        const allowed = ['trending', 'happening', 'slide', null, ''];
        payload.homeSection = allowed.includes(body.homeSection) ? (body.homeSection || null) : null;
    }
    if (body.showOnHomeSlide !== undefined) {
        payload.showOnHomeSlide = Boolean(body.showOnHomeSlide);
        if (payload.showOnHomeSlide) {
            // Prefer boolean flag over legacy homeSection:'slide'
            if (payload.homeSection === 'slide' || body.homeSection === 'slide') {
                payload.homeSection = null;
            } else if (body.homeSection === undefined) {
                // Caller may send homeSection from applyHomeAssignmentSlugs
            }
        }
    }
    if (body.customPageSections !== undefined) {
        payload.customPageSections = Array.isArray(body.customPageSections)
            ? body.customPageSections
                .filter((a) => a && a.page && a.sectionSlug)
                .map((a) => ({
                    page: String(a.page),
                    sectionSlug: String(a.sectionSlug),
                    priority: Math.max(1, Math.min(999, Number(a.priority) || 999)),
                }))
            : [];
    }
    if (body.priority !== undefined) {
        const p = parseInt(body.priority, 10);
        payload.priority = Number.isNaN(p) ? 999 : Math.max(1, Math.min(999, p));
    }
    if (body.status !== undefined && ['published', 'draft'].includes(body.status)) {
        payload.status = body.status;
    }
    return payload;
}

exports.create = async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ message: 'DB not connected' });
        const payload = sanitizeRunClubBody(req.body);
        if (!payload.name) return res.status(400).json({ message: 'Run club name is required' });
        const club = new RunClub(payload);
        await club.save();
        res.status(201).json({ message: 'Run club created', club });
    } catch (err) {
        console.error('[RunClub] create error:', err.message);
        res.status(500).json({ message: 'Failed to create run club', error: err.message });
    }
};

exports.getAll = async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ message: 'DB not connected' });
        const clubs = await RunClub.find()
            .sort({ runClubPriority: 1, createdAt: -1 })
            .limit(parseInt(req.query.limit, 10) || 100)
            .lean();
        res.json({ clubs });
    } catch (err) {
        console.error('[RunClub] getAll error:', err.message);
        res.status(500).json({ message: 'Failed to fetch run clubs', error: err.message });
    }
};

exports.getById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const club = await RunClub.findById(req.params.id).lean();
        if (!club) return res.status(404).json({ message: 'Not found' });
        res.json({ club });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch run club', error: err.message });
    }
};

exports.update = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const payload = sanitizeRunClubBody(req.body);
        const club = await RunClub.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
        if (!club) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Updated', club });
    } catch (err) {
        console.error('[RunClub] update error:', err.message);
        res.status(500).json({ message: 'Failed to update run club', error: err.message });
    }
};

exports.remove = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const club = await RunClub.findByIdAndDelete(req.params.id);
        if (!club) return res.status(404).json({ message: 'Not found' });
        // Cascade: remove all runs/activities belonging to this run club
        const { deletedCount } = await SportsEvent.deleteMany({ runClubId: req.params.id });
        res.json({ message: 'Deleted', deletedRuns: deletedCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete run club', error: err.message });
    }
};
