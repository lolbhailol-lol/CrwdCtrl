const mongoose = require('mongoose');
const SportsEvent = require('../model/sports_model');
const { sanitizeCoverImages, primaryCoverUrl } = require('../utils/sanitizeCoverImages');

const SPORT_TYPES = new Set(['run_club', 'football', 'cricket', 'badminton', 'marathon', 'gymkhana', 'other']);
const STATUSES = new Set(['draft', 'published', 'completed', 'cancelled']);
const FEATURED_SECTIONS = new Set(['upcoming', 'run_clubs', 'both']);
const HOME_SECTIONS = new Set(['trending', 'happening', 'slide']);
const PARTICIPATION_TYPES = new Set(['individual', 'team', 'both']);
const SKILL_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'all']);

function clampPriority(value) {
    const p = parseInt(value, 10);
    return Number.isNaN(p) ? 999 : Math.max(1, Math.min(999, p));
}

function normalizeImageUrl(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value.url) return String(value.url).trim();
    if (typeof value === 'object' && value.secure_url) return String(value.secure_url).trim();
    return '';
}

function normalizeImageList(images) {
    if (!Array.isArray(images)) return [];
    return images.map(normalizeImageUrl).filter(Boolean);
}

function deriveFeaturedSection(showInUpcoming, showInRunClubs) {
    if (showInUpcoming && showInRunClubs) return 'both';
    if (showInUpcoming) return 'upcoming';
    if (showInRunClubs) return 'run_clubs';
    return null;
}

function applyLegacySectionFields(payload, existing = {}) {
    if (payload.featuredSection !== undefined && payload.showInUpcoming === undefined) {
        const section = payload.featuredSection;
        if (section === 'run_clubs') payload.showInUpcoming = false;
        else if (section === 'upcoming') payload.showInUpcoming = true;
        else if (section === 'both') payload.showInUpcoming = true;
        else if (section === null) payload.showInUpcoming = existing.showInUpcoming ?? true;
    }

    if (payload.featuredSection !== undefined && payload.showInRunClubs === undefined) {
        const section = payload.featuredSection;
        const isRunClub = (payload.sportType ?? existing.sportType) === 'run_club';
        if (section === 'upcoming') payload.showInRunClubs = false;
        else if (section === 'run_clubs') payload.showInRunClubs = isRunClub;
        else if (section === 'both') payload.showInRunClubs = isRunClub;
        else if (section === null) payload.showInRunClubs = existing.showInRunClubs ?? isRunClub;
    }

    if (payload.priority !== undefined && payload.upcomingPriority === undefined) {
        payload.upcomingPriority = payload.priority;
    }
    if (payload.upcomingPriority !== undefined && payload.priority === undefined) {
        payload.priority = payload.upcomingPriority;
    }
}

function syncFeaturedSection(payload, existing = {}) {
    const showInUpcoming = payload.showInUpcoming ?? existing.showInUpcoming ?? true;
    const showInRunClubs = payload.showInRunClubs ?? existing.showInRunClubs ?? false;
    payload.featuredSection = deriveFeaturedSection(showInUpcoming, showInRunClubs);
}

function sanitizeSportsPayload(body = {}) {
    const payload = {};

    if (body.title !== undefined) payload.title = String(body.title).trim();
    if (body.sportType !== undefined && SPORT_TYPES.has(body.sportType)) payload.sportType = body.sportType;
    if (body.organizer !== undefined) payload.organizer = String(body.organizer || '').trim();
    if (body.venue !== undefined) payload.venue = String(body.venue || '').trim();
    if (body.city !== undefined) payload.city = String(body.city || '').trim();
    if (body.eventDate !== undefined) payload.eventDate = body.eventDate ? new Date(body.eventDate) : null;
    if (body.reportingTime !== undefined) payload.reportingTime = String(body.reportingTime || '').trim();
    if (body.registrationFee !== undefined) payload.registrationFee = Math.max(0, Number(body.registrationFee) || 0);
    if (body.dressCode !== undefined) payload.dressCode = String(body.dressCode || '').trim();
    if (body.participationType !== undefined && PARTICIPATION_TYPES.has(body.participationType)) {
        payload.participationType = body.participationType;
    }
    if (body.maxParticipants !== undefined) payload.maxParticipants = Math.max(0, Number(body.maxParticipants) || 0);
    if (body.skillLevel !== undefined && SKILL_LEVELS.has(body.skillLevel)) payload.skillLevel = body.skillLevel;
    if (body.prizes !== undefined) payload.prizes = String(body.prizes || '').trim();
    if (body.routeMap !== undefined) payload.routeMap = String(body.routeMap || '').trim();
    if (body.distance !== undefined) payload.distance = String(body.distance || '').trim();
    if (body.coverImages !== undefined) {
        payload.coverImages = sanitizeCoverImages(body.coverImages);
        payload.coverImage = primaryCoverUrl(payload.coverImages, body.coverImage);
    } else if (body.coverImage !== undefined) {
        payload.coverImage = normalizeImageUrl(body.coverImage);
    }
    if (body.inclusions !== undefined) {
        payload.inclusions = Array.isArray(body.inclusions)
            ? body.inclusions.map((s) => String(s).trim()).filter(Boolean)
            : [];
    }
    if (body.termsAndConditions !== undefined) {
        payload.termsAndConditions = Array.isArray(body.termsAndConditions)
            ? body.termsAndConditions.map((s) => String(s).trim()).filter(Boolean)
            : [];
    }
    if (body.returnTime !== undefined) payload.returnTime = String(body.returnTime || '').trim();
    if (body.fitnessLevel !== undefined) payload.fitnessLevel = String(body.fitnessLevel || '').trim();
    if (body.meetingPoint !== undefined) payload.meetingPoint = String(body.meetingPoint || '').trim();
    if (body.ageLimit !== undefined) payload.ageLimit = String(body.ageLimit || '').trim();
    if (body.infoSections !== undefined) {
        payload.infoSections = Array.isArray(body.infoSections)
            ? body.infoSections
                .map((s) => ({ title: String(s?.title || '').trim(), details: String(s?.details || '').trim() }))
                .filter((s) => s.title || s.details)
            : [];
    }
    if (body.contactPhone !== undefined) payload.contactPhone = String(body.contactPhone || '').trim();
    if (body.contactInstagram !== undefined) payload.contactInstagram = String(body.contactInstagram || '').trim();
    if (body.images !== undefined) {
        payload.images = normalizeImageList(body.images);
    }
    if (body.sponsors !== undefined) {
        payload.sponsors = Array.isArray(body.sponsors)
            ? body.sponsors.map((s) => String(s).trim()).filter(Boolean)
            : [];
    }
    if (body.registrationLink !== undefined) payload.registrationLink = String(body.registrationLink || '').trim();
    if (body.registration !== undefined && body.registration && typeof body.registration === 'object') {
        const r = body.registration;
        const cleanList = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s || '').trim()).filter(Boolean) : []);
        payload.registration = {
            status: ['open', 'closed'].includes(r.status) ? r.status : 'open',
            mode: ['internal_form', 'external_link', 'organizer_qr'].includes(r.mode) ? r.mode : 'internal_form',
            googleSheetsUrl: String(r.googleSheetsUrl || '').trim(),
            organizerEmail: String(r.organizerEmail || '').trim(),
            formInstructions: String(r.formInstructions || '').trim(),
            availableDates: cleanList(r.availableDates),
            timeSlots: cleanList(r.timeSlots),
            locationOptions: cleanList(r.locationOptions),
            maxPeoplePerBooking: Math.max(1, Number(r.maxPeoplePerBooking) || 10),
            paymentQR: String(r.paymentQR || '').trim(),
            paymentQRMessage: String(r.paymentQRMessage || '').trim(),
            paymentUpiId: String(r.paymentUpiId || '').trim(),
            formSchema: Array.isArray(r.formSchema)
                ? r.formSchema
                    .filter((f) => f && (f.label || f.fieldName))
                    .map((f) => ({
                        id: String(f.id || `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
                        label: String(f.label || '').trim(),
                        fieldName: String(f.fieldName || f.label || '').toLowerCase().replace(/\s+/g, '_'),
                        type: ['text', 'email', 'tel', 'number', 'textarea', 'select', 'file', 'date'].includes(f.type) ? f.type : 'text',
                        required: Boolean(f.required),
                        options: Array.isArray(f.options) ? f.options.map((o) => String(o || '').trim()).filter(Boolean) : [],
                        placeholder: String(f.placeholder || '').trim(),
                    }))
                : [],
        };
    }
    if (body.description !== undefined) payload.description = String(body.description || '');
    if (body.displayType !== undefined) payload.displayType = String(body.displayType || '').trim();
    if (body.featuredSection !== undefined) {
        payload.featuredSection = body.featuredSection && FEATURED_SECTIONS.has(body.featuredSection)
            ? body.featuredSection
            : null;
    }
    if (body.showInUpcoming !== undefined) payload.showInUpcoming = Boolean(body.showInUpcoming);
    if (body.showInRunClubs !== undefined) payload.showInRunClubs = Boolean(body.showInRunClubs);
    if (body.upcomingPriority !== undefined) payload.upcomingPriority = clampPriority(body.upcomingPriority);
    if (body.runClubPriority !== undefined) payload.runClubPriority = clampPriority(body.runClubPriority);
    if (body.priority !== undefined) payload.priority = clampPriority(body.priority);
    if (body.showOnSportsPage !== undefined) payload.showOnSportsPage = Boolean(body.showOnSportsPage);
    if (body.homeSection !== undefined) {
        payload.homeSection = body.homeSection && HOME_SECTIONS.has(body.homeSection)
            ? body.homeSection
            : null;
    }
    if (body.homeSection === '') payload.homeSection = null;
    if (body.homePriority !== undefined) payload.homePriority = clampPriority(body.homePriority);
    if (body.showOnHomeSlide !== undefined) payload.showOnHomeSlide = Boolean(body.showOnHomeSlide);
    if (body.customPageSections !== undefined) {
        payload.customPageSections = Array.isArray(body.customPageSections)
            ? body.customPageSections
                .filter((a) => a && a.page && a.sectionSlug)
                .map((a) => ({
                    page: String(a.page),
                    sectionSlug: String(a.sectionSlug),
                    priority: clampPriority(a.priority),
                }))
            : [];
    }
    if (body.runClubId !== undefined) {
        payload.runClubId = body.runClubId && mongoose.Types.ObjectId.isValid(body.runClubId)
            ? body.runClubId
            : null;
    }
    if (body.runCategory !== undefined) payload.runCategory = String(body.runCategory || '').trim();
    if (body.status !== undefined && STATUSES.has(body.status)) payload.status = body.status;

    return payload;
}

function finalizeSportsPayload(payload, existing = null) {
    applyLegacySectionFields(payload, existing || {});
    syncFeaturedSection(payload, existing || {});

    if (payload.upcomingPriority !== undefined && payload.priority === undefined) {
        payload.priority = payload.upcomingPriority;
    }
    if (payload.priority !== undefined && payload.upcomingPriority === undefined) {
        payload.upcomingPriority = payload.priority;
    }

    if (payload.sportType !== undefined && payload.sportType !== 'run_club') {
        payload.showInRunClubs = false;
    }
    if (payload.runClubId) {
        payload.showInRunClubs = false;
    }

    return payload;
}

function defaultSectionFlags(payload) {
    if (payload.showInUpcoming === undefined) payload.showInUpcoming = true;
    if (payload.showInRunClubs === undefined) {
        payload.showInRunClubs = payload.runClubId ? false : payload.sportType === 'run_club';
    }
    if (payload.upcomingPriority === undefined) payload.upcomingPriority = 999;
    if (payload.runClubPriority === undefined) payload.runClubPriority = 999;
    if (payload.priority === undefined) payload.priority = payload.upcomingPriority;
    if (payload.homePriority === undefined) payload.homePriority = 999;
    return payload;
}

function validateOrganizerQrPayment(payload, existing = null) {
    const fee = Number(
        payload.registrationFee !== undefined
            ? payload.registrationFee
            : existing?.registrationFee,
    ) || 0;
    const mode = payload.registration?.mode
        || existing?.registration?.mode
        || 'internal_form';
    const paymentQR = payload.registration?.paymentQR !== undefined
        ? payload.registration.paymentQR
        : existing?.registration?.paymentQR;
    if (mode === 'organizer_qr' && fee > 0 && !String(paymentQR || '').trim()) {
        return 'Payment QR image is required for Form + QR mode when fee is greater than 0';
    }
    return null;
}

exports.createSportsEvent = async (req, res) => {
    try {
        const payload = finalizeSportsPayload(defaultSectionFlags(sanitizeSportsPayload(req.body)));
        if (!payload.title || !payload.sportType) {
            return res.status(400).json({ message: 'title and sportType are required' });
        }
        const qrErr = validateOrganizerQrPayment(payload);
        if (qrErr) return res.status(400).json({ message: qrErr });
        const event = new SportsEvent({ ...payload, createdBy: req.user?._id || null });
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
        if (req.query.runClubId === 'null') filter.runClubId = null;
        else if (req.query.runClubId && mongoose.Types.ObjectId.isValid(req.query.runClubId)) {
            filter.runClubId = req.query.runClubId;
        }

        const total = await SportsEvent.countDocuments(filter);
        const events = await SportsEvent.find(filter)
            .sort({ priority: 1, eventDate: 1, createdAt: -1 })
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
        const existing = await SportsEvent.findById(id).lean();
        if (!existing) return res.status(404).json({ message: 'Sports event not found' });

        const payload = finalizeSportsPayload(sanitizeSportsPayload(req.body), existing);
        const qrErr = validateOrganizerQrPayment(payload, existing);
        if (qrErr) return res.status(400).json({ message: qrErr });
        const event = await SportsEvent.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
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
