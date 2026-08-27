const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');
const { findByIdOrSlug, ensureUniqueSlug, toSlug, mergePreviousSlugs, isObjectId } = require('../utils/slug');
const {
    expireStalePendingRegistrations,
    sumConfirmedSeats,
} = require('../utils/runClubRegistrationGuards');
const { getJwtSecret } = require('../config/jwtSecret');
const { registrationLimiter } = require('../middleware/rateLimiter');
const uploadCtrl = require('../controllers/uploadController');
const { getSportsGenderRegistrationSnapshot } = require('../utils/trekGenderRegistration');
const {
    listingHubForRunClubId,
    hubSourceFromListing,
    sportsActivityNoun,
    sportsNotFoundMessage,
} = require('../utils/listingHubCopy');
const { sanitizePublicSportsEvent } = require('../utils/publicEntitySanitize');

function getOptionalUserId(req) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return null;
        const token = authHeader.substring(7);
        if (!token) return null;
        const decoded = jwt.verify(token, getJwtSecret());
        return decoded.userId || null;
    } catch {
        return null;
    }
}
// GET /api/sports — list published sports events
router.get('/', async (req, res) => {
    try {
        const timeframe = String(req.query.timeframe || '').toLowerCase();
        const hasClub = Boolean(req.query.runClubId);
        const hub = String(req.query.hub || '').toLowerCase();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const and = [];

        if (hub === 'events') {
            const eventClubIds = await RunClub.find({ listingHub: 'events' }).distinct('_id');
            and.push({ status: 'published' });
            and.push({ runClubId: { $in: eventClubIds } });
        } else if (hasClub && timeframe === 'past') {
            and.push({
                $or: [
                    { status: 'completed' },
                    { status: 'published', eventDate: { $lt: startOfToday } },
                ],
            });
        } else if (hasClub && timeframe === 'upcoming') {
            and.push({ status: 'published' });
            and.push({
                $or: [
                    { eventDate: null },
                    { eventDate: { $exists: false } },
                    { eventDate: { $gte: startOfToday } },
                ],
            });
        } else if (hasClub) {
            and.push({ status: 'published' });
        } else {
            and.push({ status: 'published' });
            and.push({ showOnSportsPage: { $ne: false } });
        }

        if (req.query.sportType) and.push({ sportType: req.query.sportType });
        if (req.query.city) and.push({ city: { $regex: req.query.city, $options: 'i' } });
        if (req.query.runClubId) {
            const clubRef = String(req.query.runClubId || '').trim();
            let clubId = null;
            if (isObjectId(clubRef)) {
                clubId = clubRef;
            } else {
                const club = await findByIdOrSlug(RunClub, clubRef, {
                    baseFilter: { status: 'published' },
                    pickName: (row) => row.name,
                    lean: true,
                    select: '_id',
                });
                clubId = club?._id ? String(club._id) : null;
            }
            if (!clubId) {
                return res.status(400).json({ message: 'Invalid run club ID' });
            }
            and.push({ runClubId: clubId });
        }

        const filter = and.length === 1 ? and[0] : { $and: and };
        const sort = timeframe === 'past'
            ? { eventDate: -1, createdAt: -1 }
            : { priority: 1, eventDate: 1, createdAt: -1 };

        const events = await SportsEvent.find(filter)
            .sort(sort)
            .limit(100)
            .lean();

        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.status(200).json({
            events: events.map((e) => {
                const clean = sanitizePublicSportsEvent(e);
                if (hub === 'events') clean.listingHub = 'events';
                return clean;
            }),
        });
    } catch (error) {
        console.error('publicSports getAll error:', error);
        res.status(500).json({ message: 'Failed to fetch sports events' });
    }
});

// GET /api/sports/:id — single published or completed sports event
router.get('/:idOrSlug', async (req, res) => {
    try {
        const eventMatch = await findByIdOrSlug(SportsEvent, req.params.idOrSlug, {
            baseFilter: { status: { $in: ['published', 'completed'] } },
            pickName: (row) => row.title,
            lean: true,
        });
        if (!eventMatch) return res.status(404).json({ message: 'Sports event not found' });

        const event = await SportsEvent.findOne({
            _id: eventMatch._id,
            status: { $in: ['published', 'completed'] },
        })
            .populate('runClubId', 'name basedIn tagline organizer contactPhone contactInstagram listingHub slug')
            .lean();
        if (!event) return res.status(404).json({ message: 'Sports event not found' });
        if (event.runClubId && typeof event.runClubId === 'object') {
            event.runClub = event.runClubId;
            event.runClubId = event.runClub._id;
        }

        // Backfill slug for legacy rows so shared /sports/run/:slug links stay stable
        if (!event.slug && event.title) {
            try {
                const titleSlug = toSlug(event.title);
                const slug = await ensureUniqueSlug(SportsEvent, event.title, {
                    excludeId: event._id,
                });
                if (slug) {
                    event.slug = slug;
                    const $set = { slug };
                    if (titleSlug && titleSlug !== slug) {
                        const prev = mergePreviousSlugs(event.previousSlugs, titleSlug);
                        $set.previousSlugs = prev;
                        event.previousSlugs = prev;
                    }
                    await SportsEvent.updateOne({ _id: event._id }, { $set });
                }
            } catch (err) {
                console.warn('publicSports slug backfill failed:', err?.message || err);
            }
        } else if (event.slug && event.title) {
            // Always keep current title slug as alias when it differs from primary
            const titleSlug = toSlug(event.title);
            const primary = toSlug(event.slug);
            if (titleSlug && titleSlug !== primary) {
                const prev = Array.isArray(event.previousSlugs) ? event.previousSlugs : [];
                if (!prev.map((s) => toSlug(s)).includes(titleSlug)) {
                    try {
                        await SportsEvent.updateOne(
                            { _id: event._id },
                            { $addToSet: { previousSlugs: titleSlug } },
                        );
                        event.previousSlugs = mergePreviousSlugs(prev, titleSlug);
                    } catch (err) {
                        console.warn('publicSports title alias backfill failed:', err?.message || err);
                    }
                }
            }
        }

        // Seats: expire stale pending QR holds, then compute remaining
        await expireStalePendingRegistrations(event._id);
        const genderRegistration = await getSportsGenderRegistrationSnapshot(event);
        const capacity = Math.max(0, Number(event.maxParticipants) || 0);
        if (capacity > 0) {
            const seatsFilled = await sumConfirmedSeats(event._id);
            event.seatsFilled = seatsFilled;
            event.seatsRemaining = Math.max(0, capacity - seatsFilled);
            event.isFull = seatsFilled >= capacity
                || Boolean(genderRegistration?.enabled && genderRegistration.allGenderSeatsFull);
        } else {
            event.seatsFilled = null;
            event.seatsRemaining = null;
            event.isFull = Boolean(genderRegistration?.enabled && genderRegistration.allGenderSeatsFull);
        }
        event.genderRegistration = genderRegistration;

        res.json({ event: sanitizePublicSportsEvent(event) });
    } catch (error) {
        console.error('publicSports getById error:', error);
        res.status(500).json({ message: 'Failed to fetch sports event' });
    }
});

// POST /api/sports/:id/payment-screenshot — guest QR proof upload (when requireLogin=false or logged in)
router.post(
    '/:id/payment-screenshot',
    registrationLimiter,
    uploadCtrl.uploadSingle,
    uploadCtrl.multerErrorHandler,
    async (req, res) => {
        try {
            const eventMatch = await findByIdOrSlug(SportsEvent, req.params.id, {
                baseFilter: { status: 'published' },
                pickName: (row) => row.title || '',
                lean: true,
                select: 'runClubId registration status title',
            });
            const listingHub = eventMatch ? await listingHubForRunClubId(eventMatch.runClubId) : 'sports';
            const hub = hubSourceFromListing(listingHub);
            const noun = sportsActivityNoun(hub);
            if (!eventMatch) return res.status(404).json({ message: sportsNotFoundMessage(hub) });

            const event = await SportsEvent.findById(eventMatch._id).select('registration status').lean();
            if (!event || event.status !== 'published') {
                return res.status(404).json({ message: sportsNotFoundMessage(hub) });
            }
            if ((event.registration?.mode || 'internal_form') !== 'organizer_qr') {
                return res.status(400).json({ message: `Payment screenshots are only used for UPI / QR ${noun === 'event' ? 'events' : 'runs'}.` });
            }
            if (event.registration?.requireLogin !== false && !getOptionalUserId(req)) {
                return res.status(401).json({
                    message: `Please log in to upload a payment screenshot for this ${noun}.`,
                    requireLogin: true,
                });
            }
            if (!req.file) {
                return res.status(400).json({ message: 'Image file is required' });
            }

            return uploadCtrl.uploadImage(req, res);
        } catch (err) {
            console.error('[Sports payment-screenshot] error:', err);
            res.status(500).json({ message: 'Failed to upload payment screenshot' });
        }
    },
);

module.exports = router;
