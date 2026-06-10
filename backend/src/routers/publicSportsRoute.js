const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SportsEvent = require('../model/sports_model');

// GET /api/sports — list published sports events
router.get('/', async (req, res) => {
    try {
        const filter = { status: 'published', showOnSportsPage: { $ne: false } };
        if (req.query.sportType) filter.sportType = req.query.sportType;
        if (req.query.city) filter.city = { $regex: req.query.city, $options: 'i' };
        if (req.query.runClubId && mongoose.Types.ObjectId.isValid(req.query.runClubId)) {
            filter.runClubId = req.query.runClubId;
        }

        const events = await SportsEvent.find(filter)
            .sort({ priority: 1, eventDate: 1, createdAt: -1 })
            .limit(100)
            .lean();

        res.status(200).json({ events });
    } catch (error) {
        console.error('publicSports getAll error:', error);
        res.status(500).json({ message: 'Failed to fetch sports events' });
    }
});

// GET /api/sports/:id — single published sports event
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid sports event ID' });
        }
        const event = await SportsEvent.findOne({ _id: id, status: 'published' })
            .populate('runClubId', 'name basedIn contactPhone contactInstagram')
            .lean();
        if (!event) return res.status(404).json({ message: 'Sports event not found' });
        if (event.runClubId && typeof event.runClubId === 'object') {
            event.runClub = event.runClubId;
            event.runClubId = event.runClub._id;
        }
        res.json({ event });
    } catch (error) {
        console.error('publicSports getById error:', error);
        res.status(500).json({ message: 'Failed to fetch sports event' });
    }
});

module.exports = router;
