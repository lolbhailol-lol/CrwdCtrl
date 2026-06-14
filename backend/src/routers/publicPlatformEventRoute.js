const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PlatformEvent = require('../model/platform_event_model');

// GET /api/events — list published events, supports ?category=trek&city=pune
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = { status: 'published' };
        if (req.query.category) {
            filter.category = req.query.category;
        }
        if (req.query.city) {
            filter.city = { $regex: req.query.city, $options: 'i' };
        }

        const total = await PlatformEvent.countDocuments(filter);
        const events = await PlatformEvent.find(filter)
            .sort({ startDate: 1, createdAt: -1 })
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
                limit,
            },
        });
    } catch (error) {
        console.error('Public getEvents error:', error);
        res.status(500).json({ message: 'Failed to fetch events' });
    }
});

// GET /api/events/:id — single event detail
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid event ID' });
        }

        const event = await PlatformEvent.findOne({ _id: id, status: 'published' }).lean();

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json({ event });
    } catch (error) {
        console.error('Public getEvent error:', error);
        res.status(500).json({ message: 'Failed to fetch event' });
    }
});

module.exports = router;
