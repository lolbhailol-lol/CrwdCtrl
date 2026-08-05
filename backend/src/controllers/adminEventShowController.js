const mongoose = require('mongoose');
const EventShow = require('../model/event_show_model');
const { sanitizeEventPlatformFeePercent } = require('../utils/trekRegistrationFee');
const { sanitizeCoverImages, primaryCoverUrl } = require('../utils/sanitizeCoverImages');
const { setExclusiveEventsPageHero } = require('../utils/featuredPlacement');
const {
    sanitizeSportsTiers,
    mirrorRegistrationFeeFromTiers,
} = require('../utils/sportsPricing');

function normalizeEventShowPayload(body = {}) {
    const payload = { ...body };
    if (payload.platformFeePercent !== undefined) {
        payload.platformFeePercent = sanitizeEventPlatformFeePercent(payload.platformFeePercent);
    }
    if (payload.coverImages !== undefined) {
        payload.coverImages = sanitizeCoverImages(payload.coverImages);
        payload.poster = primaryCoverUrl(payload.coverImages, payload.poster) || '';
    }
    if (payload.mapUrl !== undefined) {
        payload.mapUrl = String(payload.mapUrl || '').trim();
    }
    if (payload.meetingPoints !== undefined) {
        payload.meetingPoints = Array.isArray(payload.meetingPoints)
            ? payload.meetingPoints
                .map((p) => ({
                    label: String(p?.label || p?.name || '').trim(),
                    mapUrl: String(p?.mapUrl || p?.url || '').trim(),
                }))
                .filter((p) => p.label)
            : [];
    }
    if (payload.pricingMode !== undefined) {
        payload.pricingMode = payload.pricingMode === 'tiers' ? 'tiers' : 'single';
    }
    if (payload.tiers !== undefined) {
        payload.tiers = sanitizeSportsTiers(payload.tiers);
    }
    const mode = payload.pricingMode
        || (body.pricingMode === 'tiers' ? 'tiers' : undefined);
    if (mode === 'tiers' || payload.pricingMode === 'tiers') {
        const tiers = payload.tiers !== undefined ? payload.tiers : sanitizeSportsTiers(body.tiers);
        if (payload.tiers !== undefined || body.tiers !== undefined) {
            payload.tiers = tiers;
        }
        if (payload.tiers && payload.tiers.length) {
            payload.ticketPrice = mirrorRegistrationFeeFromTiers('tiers', payload.tiers, payload.ticketPrice);
        }
    } else if (payload.ticketPrice !== undefined) {
        payload.ticketPrice = Math.max(0, Number(payload.ticketPrice) || 0);
    }
    return payload;
}

function resolveMaxEventFee(payload = {}) {
    if (payload.pricingMode === 'tiers') {
        return Math.max(0, ...(Array.isArray(payload.tiers) ? payload.tiers.map((t) => Number(t.fee) || 0) : [0]));
    }
    return Math.max(0, Number(payload.ticketPrice) || 0);
}

exports.createEventShow = async (req, res) => {
    try {
        const { title, eventType } = req.body;
        if (!title || !eventType) {
            return res.status(400).json({ message: 'title and eventType are required' });
        }
        const body = normalizeEventShowPayload(req.body);
        const regMode = body.registration?.mode || 'external_link';
        if (regMode === 'organizer_qr' && resolveMaxEventFee(body) > 0 && !String(body.registration?.paymentQR || '').trim()) {
            return res.status(400).json({ message: 'Payment QR is required for QR registration mode when fee is greater than 0' });
        }
        const show = new EventShow({ ...body, createdBy: req.user?._id || null });
        await show.save();
        res.status(201).json({ message: 'Event created successfully', show });
    } catch (error) {
        console.error('adminEventShow createEventShow error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation failed', details: error.message });
        }
        res.status(500).json({ message: 'Failed to create event', error: error.message });
    }
};

exports.getAllEventShows = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.eventType) filter.eventType = req.query.eventType;
        if (req.query.status) filter.status = req.query.status;

        const total = await EventShow.countDocuments(filter);
        const shows = await EventShow.find(filter)
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
        console.error('adminEventShow getAllEventShows error:', error);
        res.status(500).json({ message: 'Failed to fetch events' });
    }
};

exports.getEventShowById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const show = await EventShow.findById(id).lean();
        if (!show) return res.status(404).json({ message: 'Event not found' });
        res.json({ show });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch event', error: error.message });
    }
};

exports.updateEventShow = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const body = normalizeEventShowPayload(req.body);
        const regMode = body.registration?.mode;
        if (regMode === 'organizer_qr' && resolveMaxEventFee(body) > 0 && !String(body.registration?.paymentQR || '').trim()) {
            return res.status(400).json({ message: 'Payment QR is required for QR registration mode when fee is greater than 0' });
        }

        if (body.showOnHomeSlide === true) {
            body.showOnHomeSlide = true;
            if (body.homeSection === 'slide') body.homeSection = null;
        }

        if (body.showOnHomeSlide === false) {
            body.showOnHomeSlide = false;
        }

        if (body.pageSection === 'hero') {
            await setExclusiveEventsPageHero(id);
            delete body.pageSection;
            delete body.pagePriority;
            const show = await EventShow.findByIdAndUpdate(id, body, { new: true, runValidators: true });
            if (!show) return res.status(404).json({ message: 'Event not found' });
            return res.json({ message: 'Event updated successfully', show });
        }

        const show = await EventShow.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!show) return res.status(404).json({ message: 'Event not found' });
        res.json({ message: 'Event updated successfully', show });
    } catch (error) {
        console.error('adminEventShow updateEventShow error:', error);
        res.status(500).json({ message: 'Failed to update event', error: error.message });
    }
};

exports.deleteEventShow = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const show = await EventShow.findByIdAndDelete(id);
        if (!show) return res.status(404).json({ message: 'Event not found' });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete event' });
    }
};
