const mongoose = require('mongoose');
const SportsEvent = require('../model/sports_model');

exports.createSportsEvent = async (req, res) => {
    try {
        const { title, sportType } = req.body;
        if (!title || !sportType) {
            return res.status(400).json({ message: 'title and sportType are required' });
        }
        const event = new SportsEvent({ ...req.body, createdBy: req.user?._id || null });
        await event.save();
        res.status(201).json({ message: 'Sports event created successfully', event });
    } catch (error) {
        console.error('adminSports createSportsEvent error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation failed', details: error.message });
        }
        res.status(500).json({ message: 'Failed to create sports event', error: error.message });
    }
};

exports.getAllSportsEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.sportType) filter.sportType = req.query.sportType;
        if (req.query.status) filter.status = req.query.status;

        const total = await SportsEvent.countDocuments(filter);
        const events = await SportsEvent.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            events,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            },
        });
    } catch (error) {
        console.error('adminSports getAllSportsEvents error:', error);
        res.status(500).json({ message: 'Failed to fetch sports events' });
    }
};

exports.getSportsEventById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const event = await SportsEvent.findById(id).lean();
        if (!event) return res.status(404).json({ message: 'Sports event not found' });
        res.json({ event });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch sports event', error: error.message });
    }
};

exports.updateSportsEvent = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const event = await SportsEvent.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!event) return res.status(404).json({ message: 'Sports event not found' });
        res.json({ message: 'Sports event updated successfully', event });
    } catch (error) {
        console.error('adminSports updateSportsEvent error:', error);
        res.status(500).json({ message: 'Failed to update sports event', error: error.message });
    }
};

exports.deleteSportsEvent = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const event = await SportsEvent.findByIdAndDelete(id);
        if (!event) return res.status(404).json({ message: 'Sports event not found' });
        res.json({ message: 'Sports event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete sports event' });
    }
};
