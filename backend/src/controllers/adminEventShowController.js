const mongoose = require('mongoose');
const EventShow = require('../model/event_show_model');
const EventShowRegistration = require('../model/event_show_registration_model');
const { sanitizeEventPlatformFeePercent } = require('../utils/trekRegistrationFee');
const { sanitizeCoverImages, primaryCoverUrl } = require('../utils/sanitizeCoverImages');
const { setExclusiveEventsPageHero } = require('../utils/featuredPlacement');
const {
    sanitizeSportsTiers,
    sanitizeEventAddOns,
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
    if (payload.addOns !== undefined) {
        payload.addOns = sanitizeEventAddOns(payload.addOns);
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
    const packageFee = payload.pricingMode === 'tiers'
        ? Math.max(0, ...(Array.isArray(payload.tiers) ? payload.tiers.map((t) => Number(t.fee) || 0) : [0]))
        : Math.max(0, Number(payload.ticketPrice) || 0);
    const addOnTotal = sanitizeEventAddOns(payload.addOns)
        .reduce((sum, addOn) => sum + addOn.fee, 0);
    return packageFee + addOnTotal;
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

function responsesToObject(responses) {
    if (!responses) return {};
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses.toObject === 'function') return responses.toObject();
    return { ...responses };
}

function formatAdminEventRegistration(reg) {
    const responses = responsesToObject(reg.responses);
    const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
    const formName = String(
        responses.leader_name || responses.full_name || responses.name || '',
    ).trim();
    const formEmail = String(responses.email || '').trim();
    const formPhone = String(
        responses.phone || responses.contact_no || responses.mobile || '',
    ).trim();

    return {
        ...reg,
        user: {
            name: formName || user?.name || '',
            email: formEmail || user?.email || '',
            phone: formPhone || user?.phone || '',
        },
        responses,
        reRegistrationCount: Number(reg.reRegistrationCount) || (reg.additionalEntries?.length || 0),
    };
}

exports.getEventShowRegistrations = async (req, res) => {
    try {
        const { eventShowId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(eventShowId)) {
            return res.status(400).json({ message: 'Invalid event ID' });
        }

        const event = await EventShow.findById(eventShowId).select('title displayName registration').lean();
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 500));
        const regs = await EventShowRegistration.find({ eventShow: eventShowId })
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const registrations = regs.map(formatAdminEventRegistration);
        res.json({ registrations, total: registrations.length, event });
    } catch (error) {
        console.error('adminEventShow getEventShowRegistrations error:', error);
        res.status(500).json({ message: 'Failed to fetch event registrations' });
    }
};

exports.updateEventShowRegistrationStatus = async (req, res) => {
    try {
        const { registrationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ message: 'Invalid registration ID' });
        }

        const status = String(req.body.status || '').toLowerCase();
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const reg = await EventShowRegistration.findById(registrationId);
        if (!reg) return res.status(404).json({ message: 'Registration not found' });

        reg.status = status;
        if (status === 'approved' && reg.paymentStatus === 'pending') {
            reg.paymentStatus = 'paid';
        }
        if (status === 'rejected' && reg.paymentStatus === 'pending') {
            reg.paymentStatus = 'failed';
        }
        await reg.save();

        res.json({
            message: 'Registration status updated',
            registration: formatAdminEventRegistration(reg.toObject()),
        });
    } catch (error) {
        console.error('adminEventShow updateEventShowRegistrationStatus error:', error);
        res.status(500).json({ message: 'Failed to update registration status' });
    }
};
