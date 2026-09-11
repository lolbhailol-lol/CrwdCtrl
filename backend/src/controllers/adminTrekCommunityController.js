const mongoose = require('mongoose');
const TrekCommunity = require('../model/trek_community_model');
const Trek = require('../model/trek_model');

const { sanitizeCoverImages, primaryCoverUrl } = require('../utils/sanitizeCoverImages');

const dbOk = () => mongoose.connection.readyState === 1;

const sanitizeContacts = (list) => {
    if (!Array.isArray(list)) return [];
    return list
        .map((c) => ({
            name: String(c?.name || '').trim(),
            role: String(c?.role || '').trim(),
            phone: String(c?.phone || '').trim(),
        }))
        .filter((c) => c.name || c.role || c.phone);
};

function normalizeCommunityPayload(body) {
    const payload = { ...body };
    if (body.homeSection === '') payload.homeSection = null;
    if (body.contacts !== undefined) payload.contacts = sanitizeContacts(body.contacts);
    if (body.groupLink !== undefined) {
        payload.groupLink = String(body.groupLink || '').trim();
    }
    if (body.paymentGateway !== undefined) {
        const gw = String(body.paymentGateway || '').trim().toLowerCase();
        payload.paymentGateway = gw === 'razorpay' ? 'razorpay' : 'cashfree';
    }
    if (body.cashfreeMerchant !== undefined) {
        const m = String(body.cashfreeMerchant || '').trim().toLowerCase();
        payload.cashfreeMerchant = m === 'events' ? 'events' : 'platform';
    }
    if (body.coverImages !== undefined) {
        payload.coverImages = sanitizeCoverImages(body.coverImages);
        payload.coverImage = primaryCoverUrl(payload.coverImages, body.coverImage);
    } else if (body.coverImage !== undefined) {
        payload.coverImage = String(body.coverImage || '').trim();
    }
    return payload;
}

exports.create = async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ message: 'DB not connected', readyState: mongoose.connection.readyState });
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Community name is required' });
        const body = normalizeCommunityPayload(req.body);
        const community = new TrekCommunity(body);
        await community.save();
        res.status(201).json({ message: 'Community created', community });
    } catch (err) {
        console.error('[TrekCommunity] create error:', err.message);
        res.status(500).json({ message: 'Failed to create community', error: err.message });
    }
};

exports.getAll = async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ message: 'DB not connected', readyState: mongoose.connection.readyState });
        const communities = await TrekCommunity.find()
            .sort({ trekPagePriority: 1, createdAt: -1 })
            .limit(parseInt(req.query.limit) || 100)
            .lean();
        res.json({ communities });
    } catch (err) {
        console.error('[TrekCommunity] getAll error:', err.message);
        res.status(500).json({ message: 'Failed to fetch communities', error: err.message });
    }
};

exports.getById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid ID' });
        const community = await TrekCommunity.findById(req.params.id).lean();
        if (!community) return res.status(404).json({ message: 'Not found' });
        res.json({ community });
    } catch (err) {
        console.error('[TrekCommunity] getById error:', err.message);
        res.status(500).json({ message: 'Failed to fetch community', error: err.message });
    }
};

exports.update = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid ID' });
        const body = normalizeCommunityPayload(req.body);
        // Use save() so unique slug pre-save runs
        const community = await TrekCommunity.findById(req.params.id);
        if (!community) return res.status(404).json({ message: 'Not found' });
        Object.keys(body).forEach((key) => {
            community[key] = body[key];
        });
        await community.save();
        res.json({ message: 'Updated', community });
    } catch (err) {
        console.error('[TrekCommunity] update error:', err.message);
        res.status(500).json({ message: 'Failed to update community', error: err.message });
    }
};

exports.remove = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid ID' });
        const community = await TrekCommunity.findByIdAndDelete(req.params.id);
        if (!community) return res.status(404).json({ message: 'Not found' });
        // Cascade: remove all treks belonging to this community
        const { deletedCount } = await Trek.deleteMany({ communityId: req.params.id });
        res.json({ message: 'Deleted', deletedTreks: deletedCount });
    } catch (err) {
        console.error('[TrekCommunity] remove error:', err.message);
        res.status(500).json({ message: 'Failed to delete community', error: err.message });
    }
};
