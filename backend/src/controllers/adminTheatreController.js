const mongoose = require('mongoose');
const Theatre = require('../model/theatre_model');

exports.createTheatre = async (req, res) => {
    try {
        const { title, theatreType } = req.body;
        if (!title || !theatreType) {
            return res.status(400).json({ message: 'title and theatreType are required' });
        }
        const show = new Theatre({ ...req.body, createdBy: req.user?._id || null });
        await show.save();
        res.status(201).json({ message: 'Theatre event created successfully', show });
    } catch (error) {
        console.error('adminTheatre createTheatre error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation failed', details: error.message });
        }
        res.status(500).json({ message: 'Failed to create theatre event', error: error.message });
    }
};

exports.getAllTheatre = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.theatreType) filter.theatreType = req.query.theatreType;
        if (req.query.status) filter.status = req.query.status;

        const total = await Theatre.countDocuments(filter);
        const shows = await Theatre.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            shows,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            },
        });
    } catch (error) {
        console.error('adminTheatre getAllTheatre error:', error);
        res.status(500).json({ message: 'Failed to fetch theatre events' });
    }
};

exports.getTheatreById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const show = await Theatre.findById(id).lean();
        if (!show) return res.status(404).json({ message: 'Theatre event not found' });
        res.json({ show });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch theatre event', error: error.message });
    }
};

exports.updateTheatre = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const show = await Theatre.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!show) return res.status(404).json({ message: 'Theatre event not found' });
        res.json({ message: 'Theatre event updated successfully', show });
    } catch (error) {
        console.error('adminTheatre updateTheatre error:', error);
        res.status(500).json({ message: 'Failed to update theatre event', error: error.message });
    }
};

exports.deleteTheatre = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const show = await Theatre.findByIdAndDelete(id);
        if (!show) return res.status(404).json({ message: 'Theatre event not found' });
        res.json({ message: 'Theatre event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete theatre event' });
    }
};
