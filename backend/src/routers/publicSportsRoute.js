const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const SportsEvent = require('../model/sports_model');
const { findByIdOrSlug, toSlug } = require('../utils/slug');
const {
    expireStalePendingRegistrations,
    sumConfirmedSeats,
} = require('../utils/runClubRegistrationGuards');

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

        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.status(200).json({ events });
    } catch (error) {
        console.error('publicSports getAll error:', error);
        res.status(500).json({ message: 'Failed to fetch sports events' });
    }
});

// GET /api/sports/:id — single published sports event
router.get('/:idOrSlug', async (req, res) => {
    try {
        const eventMatch = await findByIdOrSlug(SportsEvent, req.params.idOrSlug, {
            baseFilter: { status: 'published' },
            pickName: (row) => row.title,
            lean: true,
        });
        if (!eventMatch) return res.status(404).json({ message: 'Sports event not found' });

        const event = await SportsEvent.findOne({ _id: eventMatch._id, status: 'published' })
            .populate('runClubId', 'name basedIn contactPhone contactInstagram')
            .lean();
        if (!event) return res.status(404).json({ message: 'Sports event not found' });
        if (event.runClubId && typeof event.runClubId === 'object') {
            event.runClub = event.runClubId;
            event.runClubId = event.runClub._id;
        }

        // Backfill slug for legacy rows so shared /sports/run/:slug links stay stable
        if (!event.slug && event.title) {
            const slug = toSlug(event.title);
            if (slug) {
                event.slug = slug;
                SportsEvent.updateOne({ _id: event._id }, { $set: { slug } }).catch(() => {});
            }
        }

        // Seats: expire stale pending QR holds, then compute remaining
        await expireStalePendingRegistrations(event._id);
        const capacity = Math.max(0, Number(event.maxParticipants) || 0);
        if (capacity > 0) {
            const seatsFilled = await sumConfirmedSeats(event._id);
            event.seatsFilled = seatsFilled;
            event.seatsRemaining = Math.max(0, capacity - seatsFilled);
            event.isFull = seatsFilled >= capacity;
        } else {
            event.seatsFilled = null;
            event.seatsRemaining = null;
            event.isFull = false;
        }

        res.json({ event });
    } catch (error) {
        console.error('publicSports getById error:', error);
        res.status(500).json({ message: 'Failed to fetch sports event' });
    }
});

module.exports = router;
