const mongoose = require('mongoose');
const TrekCommunity = require('../model/trek_community_model');

const dbOk = () => mongoose.connection.readyState === 1;

exports.create = async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ message: 'DB not connected', readyState: mongoose.connection.readyState });
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Community name is required' });
        const body = { ...req.body };
        if (body.homeSection === '') body.homeSection = null;
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
        const body = { ...req.body };
        if (body.homeSection === '') body.homeSection = null;
        const community = await TrekCommunity.findByIdAndUpdate(
            req.params.id, { $set: body }, { new: true, runValidators: false }
        );
        if (!community) return res.status(404).json({ message: 'Not found' });
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
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('[TrekCommunity] remove error:', err.message);
        res.status(500).json({ message: 'Failed to delete community', error: err.message });
    }
};
