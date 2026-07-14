const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const RunClubOrganizerAccount = require('../model/run_club_organizer_account_model');
const RunClub = require('../model/run_club_model');
const SportsEvent = require('../model/sports_model');
const CategoryRegistration = require('../model/category_registration_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { performCheckinFromRaw } = require('../services/checkinService');
const {
    notifyRunClubParticipant,
    notifyRunClubParticipants,
} = require('../utils/runClubParticipantOutreach');
const {
    formatParticipantDetail,
    formatParticipantSheetRow,
    buildSheetColumns,
    participantsToCsv,
} = require('../utils/runClubOrganizerFormat');
const {
    normalizeUsername,
    getOrganizerEvents,
    getOrganizerRunClub,
} = require('../utils/runClubOrganizerAccess');
const {
    expireStalePendingRegistrations,
    PENDING_TTL_HOURS,
    peopleFromRegistration,
    sumSeatsHeld,
} = require('../utils/runClubRegistrationGuards');
const {
    decryptRegistrationPii,
    decryptManyRegistrations,
    searchTokensForQuery,
} = require('../utils/runClubPiiCrypto');
const RunClubManagerProfileInvite = require('../model/run_club_manager_profile_invite_model');

const TOKEN_TTL = '7d';
const STATUSES = new Set(['draft', 'published', 'completed', 'cancelled']);
const FIELD_TYPES = new Set(['text', 'email', 'tel', 'number', 'textarea', 'select', 'file', 'date']);

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function getEventCapacity(event) {
    return Math.max(0, Number(event?.maxParticipants) || 0);
}

function normalizeImageUrl(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value.url) return String(value.url).trim();
    if (typeof value === 'object' && value.secure_url) return String(value.secure_url).trim();
    return '';
}

function sanitizeFormSchema(formSchema) {
    if (!Array.isArray(formSchema)) return [];
    return formSchema
        .filter((f) => f && (f.label || f.fieldName))
        .map((f) => ({
            id: String(f.id || `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
            label: String(f.label || '').trim(),
            fieldName: String(f.fieldName || f.label || '')
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, ''),
            type: FIELD_TYPES.has(f.type) ? f.type : 'text',
            required: Boolean(f.required),
            options: Array.isArray(f.options)
                ? f.options.map((o) => String(o || '').trim()).filter(Boolean)
                : [],
            placeholder: String(f.placeholder || '').trim(),
        }))
        .filter((f) => f.label && f.fieldName);
}

function sanitizeOrganizerEventBody(body = {}, { partial = false, existing = null } = {}) {
    const payload = {};

    if (!partial || body.title !== undefined) {
        payload.title = String(body.title || '').trim();
    }
    if (body.venue !== undefined) payload.venue = String(body.venue || '').trim();
    if (body.city !== undefined) payload.city = String(body.city || '').trim();
    if (body.eventDate !== undefined) {
        payload.eventDate = body.eventDate ? new Date(body.eventDate) : null;
    }
    if (body.reportingTime !== undefined) payload.reportingTime = String(body.reportingTime || '').trim();
    if (body.distance !== undefined) payload.distance = String(body.distance || '').trim();
    if (body.coverImage !== undefined) payload.coverImage = normalizeImageUrl(body.coverImage);
    if (body.description !== undefined) payload.description = String(body.description || '');
    if (body.maxParticipants !== undefined) {
        payload.maxParticipants = Math.max(0, Number(body.maxParticipants) || 0);
    }
    if (body.meetingPoint !== undefined) payload.meetingPoint = String(body.meetingPoint || '').trim();
    if (body.routeMap !== undefined) payload.routeMap = String(body.routeMap || '').trim();
    if (body.fitnessLevel !== undefined) payload.fitnessLevel = String(body.fitnessLevel || '').trim();
    if (body.returnTime !== undefined) payload.returnTime = String(body.returnTime || '').trim();
    if (body.ageLimit !== undefined) payload.ageLimit = String(body.ageLimit || '').trim();
    if (body.contactPhone !== undefined) payload.contactPhone = String(body.contactPhone || '').trim();
    if (body.contactInstagram !== undefined) {
        payload.contactInstagram = String(body.contactInstagram || '').trim();
    }
    if (body.runCategory !== undefined) payload.runCategory = String(body.runCategory || '').trim();
    if (body.status !== undefined && STATUSES.has(body.status)) payload.status = body.status;

    if (body.registrationFee !== undefined) {
        payload.registrationFee = Math.max(0, Number(body.registrationFee) || 0);
    }
    // registrationLink / mode stay admin-owned — do not accept organizer overrides

    if (body.registration !== undefined && body.registration && typeof body.registration === 'object') {
        const r = body.registration;
        const existingReg = existing?.registration || {};
        // Registration mode is admin-owned — organizers cannot change it
        const nextMode = existingReg.mode || 'internal_form';
        payload.registration = {
            status: ['open', 'closed'].includes(r.status)
                ? r.status
                : (existingReg.status || 'open'),
            mode: nextMode,
            googleSheetsUrl: r.googleSheetsUrl !== undefined
                ? String(r.googleSheetsUrl || '').trim()
                : (existingReg.googleSheetsUrl || ''),
            organizerEmail: r.organizerEmail !== undefined
                ? String(r.organizerEmail || '').trim()
                : (existingReg.organizerEmail || ''),
            formInstructions: r.formInstructions !== undefined
                ? String(r.formInstructions || '').trim()
                : (existingReg.formInstructions || ''),
            availableDates: [],
            timeSlots: [],
            locationOptions: [],
            maxPeoplePerBooking: Math.max(
                1,
                Number(r.maxPeoplePerBooking ?? existingReg.maxPeoplePerBooking) || 10,
            ),
            paymentQR: r.paymentQR !== undefined
                ? normalizeImageUrl(r.paymentQR)
                : (existingReg.paymentQR || ''),
            paymentQRMessage: r.paymentQRMessage !== undefined
                ? String(r.paymentQRMessage || '').trim()
                : (existingReg.paymentQRMessage || ''),
            paymentUpiId: r.paymentUpiId !== undefined
                ? String(r.paymentUpiId || '').trim()
                : (existingReg.paymentUpiId || ''),
            formSchema: r.formSchema !== undefined
                ? sanitizeFormSchema(r.formSchema)
                : (Array.isArray(existingReg.formSchema) ? existingReg.formSchema : []),
        };
    }

    payload.sportType = 'run_club';

    return payload;
}

function assertOrganizerPricingValid(payload, existing = null) {
    const fee = payload.registrationFee !== undefined
        ? payload.registrationFee
        : Number(existing?.registrationFee) || 0;
    const mode = existing?.registration?.mode || 'internal_form';
    const paymentQR = payload.registration?.paymentQR !== undefined
        ? payload.registration.paymentQR
        : existing?.registration?.paymentQR;
    if (mode === 'organizer_qr' && fee > 0 && !String(paymentQR || '').trim()) {
        return 'Upload a payment QR image when fee is greater than ₹0 (Form + QR mode).';
    }
    return null;
}

function resolveEventRunClubId(event, organizer) {
    return event?.runClubId || organizer?.runClubId || null;
}

function formatOrganizerEvent(event) {
    if (!event) return null;
    const plain = typeof event.toObject === 'function' ? event.toObject() : event;
    return {
        ...plain,
        id: plain._id,
    };
}

/** Published clubs for signup dropdown (id + name + city only). */
exports.listSignupClubs = async (req, res) => {
    try {
        const clubs = await RunClub.find({
            status: 'published',
            showOnSportsPage: { $ne: false },
            showInRunClubs: { $ne: false },
        })
            .select('name basedIn')
            .sort({ name: 1 })
            .limit(200)
            .lean();

        res.json({
            success: true,
            clubs: clubs.map((c) => ({
                id: c._id,
                name: c.name,
                basedIn: c.basedIn || '',
            })),
        });
    } catch (error) {
        console.error('[runClubOrganizer.listSignupClubs]', error);
        res.status(500).json({ success: false, message: 'Failed to load run clubs' });
    }
};

/**
 * Consumer Profile sidebar: only allowlisted emails see Club manager.
 * Requires normal user JWT (not organizer token).
 * Eligible if Profile-emails invite OR approved organizer account with same email.
 */
exports.profileEligible = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.json({ success: true, eligible: false });
        }
        const User = require('../model/usermodel');
        const user = await User.findById(userId).select('email').lean();
        const email = String(user?.email || '').trim().toLowerCase();
        if (!email) {
            return res.json({ success: true, eligible: false });
        }

        const invite = await RunClubManagerProfileInvite.findOne({
            email,
            isActive: true,
        }).select('_id').lean();
        if (invite) {
            return res.json({ success: true, eligible: true });
        }

        const organizers = await RunClubOrganizerAccount.find({ email }).lean();
        const approved = organizers.some((org) => RunClubOrganizerAccount.canLogin(org));
        res.json({ success: true, eligible: approved });
    } catch (error) {
        console.error('[runClubOrganizer.profileEligible]', error);
        res.status(500).json({ success: false, eligible: false, message: 'Failed to check access' });
    }
};

exports.signup = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const runClubId = req.body.runClubId;

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required — use the same email CrwdCtrl approved for Club manager access',
            });
        }
        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Username must be at least 3 characters (letters, numbers, underscore)',
            });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        if (!runClubId || !mongoose.Types.ObjectId.isValid(runClubId)) {
            return res.status(400).json({ success: false, message: 'Select a valid run club' });
        }

        const invite = await RunClubManagerProfileInvite.findOne({
            email,
            isActive: true,
        }).select('_id').lean();
        if (!invite) {
            return res.status(403).json({
                success: false,
                code: 'invite_required',
                message:
                    'This email is not approved for club manager signup. Ask CrwdCtrl to add your email under Admin → Profile emails first.',
            });
        }

        const runClub = await RunClub.findOne({
            _id: runClubId,
            status: 'published',
        }).select('_id name').lean();
        if (!runClub) {
            return res.status(400).json({ success: false, message: 'Run club not found or not published yet' });
        }

        const existing = await RunClubOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }

        const organizer = await RunClubOrganizerAccount.create({
            name,
            username,
            email,
            passwordHash: await RunClubOrganizerAccount.hashPassword(password),
            phone,
            runClubId,
            status: 'pending',
            isActive: false,
            createdBy: null,
        });

        res.status(201).json({
            success: true,
            message: 'Account created. CrwdCtrl will review and approve your login shortly.',
            organizer: {
                id: organizer._id,
                name: organizer.name,
                username: organizer.username,
                status: organizer.status,
                runClubId: organizer.runClubId,
                runClubName: runClub.name,
            },
        });
    } catch (error) {
        console.error('[runClubOrganizer.signup]', error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }
        res.status(500).json({ success: false, message: 'Failed to create account' });
    }
};

exports.login = async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username || req.body.email);
        const password = String(req.body.password || '');

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const organizer = await RunClubOrganizerAccount.findOne({
            $or: [{ username }, { email: username }],
        });
        if (!organizer) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await organizer.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const status = RunClubOrganizerAccount.effectiveStatus(organizer);
        if (status === 'pending') {
            return res.status(403).json({
                success: false,
                code: 'pending_approval',
                message: 'Account awaiting CrwdCtrl approval. You can sign in after an admin approves your access.',
            });
        }
        if (status === 'rejected') {
            return res.status(403).json({
                success: false,
                code: 'rejected',
                message: organizer.rejectedReason
                    ? `Access was not approved: ${organizer.rejectedReason}`
                    : 'Access was not approved. Contact CrwdCtrl if you think this is a mistake.',
            });
        }
        if (!organizer.isActive) {
            return res.status(403).json({
                success: false,
                code: 'inactive',
                message: 'This organizer account is deactivated. Contact CrwdCtrl support.',
            });
        }

        organizer.lastLoginAt = new Date();
        // Backfill status for legacy accounts that logged in successfully
        if (!organizer.status) {
            organizer.status = 'approved';
        }
        await organizer.save();

        const token = jwt.sign(
            { organizerId: organizer._id, role: 'run_club_organizer', username: organizer.username },
            getJwtSecret(),
            { expiresIn: TOKEN_TTL },
        );

        const [events, runClub] = await Promise.all([
            getOrganizerEvents(organizer),
            getOrganizerRunClub(organizer),
        ]);

        const eventIds = events.map((e) => e._id).filter(Boolean);
        let pendingByEvent = {};
        if (eventIds.length > 0) {
            const pendingCounts = await CategoryRegistration.aggregate([
                {
                    $match: {
                        category: 'sports',
                        eventId: { $in: eventIds },
                        status: 'pending',
                        paymentStatus: 'pending',
                    },
                },
                { $group: { _id: '$eventId', count: { $sum: 1 } } },
            ]);
            pendingByEvent = Object.fromEntries(
                pendingCounts.map((row) => [String(row._id), row.count]),
            );
        }

        res.json({
            success: true,
            token,
            organizer: {
                id: organizer._id,
                name: organizer.name,
                username: organizer.username,
                phone: organizer.phone,
                runClubId: organizer.runClubId,
                status: RunClubOrganizerAccount.effectiveStatus(organizer),
            },
            runClub,
            events: events.map((e) => ({
                ...e,
                pendingPaymentReview: pendingByEvent[String(e._id)] || 0,
            })),
        });
    } catch (error) {
        console.error('[runClubOrganizer.login]', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const [events, runClub] = await Promise.all([
            getOrganizerEvents(req.organizer),
            getOrganizerRunClub(req.organizer),
        ]);

        const eventIds = events.map((e) => e._id).filter(Boolean);
        let pendingByEvent = {};
        if (eventIds.length > 0) {
            const pendingCounts = await CategoryRegistration.aggregate([
                {
                    $match: {
                        category: 'sports',
                        eventId: { $in: eventIds },
                        status: 'pending',
                        paymentStatus: 'pending',
                    },
                },
                { $group: { _id: '$eventId', count: { $sum: 1 } } },
            ]);
            pendingByEvent = Object.fromEntries(
                pendingCounts.map((row) => [String(row._id), row.count]),
            );
        }

        const eventsWithPending = events.map((e) => ({
            ...e,
            pendingPaymentReview: pendingByEvent[String(e._id)] || 0,
        }));

        res.json({
            success: true,
            organizer: {
                id: req.organizer._id,
                name: req.organizer.name,
                username: req.organizer.username,
                phone: req.organizer.phone,
                runClubId: req.organizer.runClubId,
            },
            runClub,
            events: eventsWithPending,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
};

exports.listEvents = async (req, res) => {
    try {
        if (!req.organizer?.runClubId) {
            return res.status(400).json({ success: false, message: 'No run club linked to this account' });
        }
        const events = await getOrganizerEvents(req.organizer);
        res.json({ success: true, events });
    } catch (error) {
        console.error('[runClubOrganizer.listEvents]', error);
        res.status(500).json({ success: false, message: 'Failed to list runs' });
    }
};

exports.getEvent = async (req, res) => {
    try {
        const event = await SportsEvent.findById(req.eventId).lean();
        if (!event) return res.status(404).json({ success: false, message: 'Run not found' });
        res.json({ success: true, event: formatOrganizerEvent(event) });
    } catch (error) {
        console.error('[runClubOrganizer.getEvent]', error);
        res.status(500).json({ success: false, message: 'Failed to load run' });
    }
};

exports.createEvent = async (req, res) => {
    try {
        if (!req.organizer?.runClubId) {
            return res.status(400).json({ success: false, message: 'No run club linked to this account' });
        }

        const body = sanitizeOrganizerEventBody(req.body, { partial: false });
        if (!body.title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }
        const pricingError = assertOrganizerPricingValid(body, null);
        if (pricingError) {
            return res.status(400).json({ success: false, message: pricingError });
        }

        const runClub = await getOrganizerRunClub(req.organizer);
        const status = body.status && STATUSES.has(body.status) ? body.status : 'draft';
        const defaultCategory = body.runCategory
            || (Array.isArray(runClub?.runCategories) && runClub.runCategories[0])
            || '';

        const event = new SportsEvent({
            title: body.title,
            sportType: 'run_club',
            runClubId: req.organizer.runClubId,
            organizer: runClub?.name || req.organizer.name || '',
            venue: body.venue || '',
            city: body.city || runClub?.basedIn || '',
            eventDate: body.eventDate || null,
            reportingTime: body.reportingTime || '',
            registrationFee: body.registrationFee ?? 0,
            registrationLink: body.registrationLink || '',
            maxParticipants: body.maxParticipants || 0,
            distance: body.distance || '',
            coverImage: body.coverImage || '',
            description: body.description || '',
            meetingPoint: body.meetingPoint || '',
            routeMap: body.routeMap || '',
            fitnessLevel: body.fitnessLevel || '',
            returnTime: body.returnTime || '',
            ageLimit: body.ageLimit || '',
            contactPhone: body.contactPhone || runClub?.contactPhone || req.organizer.phone || '',
            contactInstagram: body.contactInstagram || runClub?.contactInstagram || '',
            runCategory: defaultCategory,
            status,
            showInUpcoming: true,
            showInRunClubs: false,
            showOnSportsPage: true,
            featuredSection: 'upcoming',
            images: body.coverImage ? [body.coverImage] : [],
            registration: body.registration || {
                status: 'open',
                mode: 'internal_form',
                googleSheetsUrl: '',
                organizerEmail: '',
                formInstructions: '',
                availableDates: [],
                timeSlots: [],
                locationOptions: [],
                maxPeoplePerBooking: 10,
                paymentQR: '',
                paymentQRMessage: '',
                paymentUpiId: '',
                formSchema: [],
            },
        });

        await event.save();
        res.status(201).json({
            success: true,
            message: 'Run created',
            event: formatOrganizerEvent(event),
        });
    } catch (error) {
        console.error('[runClubOrganizer.createEvent]', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to create run' });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const existing = await SportsEvent.findById(req.eventId);
        if (!existing) return res.status(404).json({ success: false, message: 'Run not found' });

        const body = sanitizeOrganizerEventBody(req.body, { partial: true, existing });
        if (body.title !== undefined && !body.title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const pricingError = assertOrganizerPricingValid(body, existing);
        if (pricingError) {
            return res.status(400).json({ success: false, message: pricingError });
        }

        body.sportType = 'run_club';
        body.runClubId = req.organizer.runClubId;
        if (body.coverImage !== undefined) {
            body.images = body.coverImage ? [body.coverImage] : [];
        }
        body.showOnSportsPage = true;
        if (body.showInUpcoming === undefined) body.showInUpcoming = true;

        Object.keys(body).forEach((key) => {
            if (key === 'registration' && body.registration) {
                existing.registration = {
                    ...(existing.registration?.toObject?.() || existing.registration || {}),
                    ...body.registration,
                };
                existing.markModified('registration');
            } else {
                existing[key] = body[key];
            }
        });
        await existing.save();

        res.json({
            success: true,
            message: 'Run updated',
            event: formatOrganizerEvent(existing),
        });
    } catch (error) {
        console.error('[runClubOrganizer.updateEvent]', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to update run' });
    }
};

exports.publishEvent = async (req, res) => {
    try {
        const event = await SportsEvent.findById(req.eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Run not found' });

        if (!String(event.title || '').trim()) {
            return res.status(400).json({ success: false, message: 'Add a title before publishing' });
        }

        event.status = 'published';
        event.sportType = 'run_club';
        event.showOnSportsPage = true;
        event.showInUpcoming = true;
        if (!event.registration) event.registration = {};
        // Preserve admin payment mode / QR / fee — only ensure registration is open if unset
        if (!event.registration.status) event.registration.status = 'open';

        await event.save();
        res.json({
            success: true,
            message: 'Run published',
            event: formatOrganizerEvent(event),
        });
    } catch (error) {
        console.error('[runClubOrganizer.publishEvent]', error);
        res.status(500).json({ success: false, message: 'Failed to publish run' });
    }
};

exports.setRegistrationStatus = async (req, res) => {
    try {
        const status = String(req.body.status || '').toLowerCase();
        if (!['open', 'closed'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be open or closed' });
        }

        const event = await SportsEvent.findById(req.eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Run not found' });

        if (!event.registration) event.registration = {};
        event.registration.status = status;
        // Do not touch mode / paymentQR / fee
        await event.save();

        res.json({
            success: true,
            message: status === 'open' ? 'Registration opened' : 'Registration closed',
            event: formatOrganizerEvent(event),
        });
    } catch (error) {
        console.error('[runClubOrganizer.setRegistrationStatus]', error);
        res.status(500).json({ success: false, message: 'Failed to update registration status' });
    }
};

exports.expirePendingPayments = async (req, res) => {
    try {
        const expired = await expireStalePendingRegistrations(req.eventId);
        res.json({
            success: true,
            expired,
            ttlHours: PENDING_TTL_HOURS,
            message: expired
                ? `Expired ${expired} stale pending payment(s)`
                : 'No stale pending payments to expire',
        });
    } catch (error) {
        console.error('[runClubOrganizer.expirePendingPayments]', error);
        res.status(500).json({ success: false, message: 'Failed to expire pending payments' });
    }
};

exports.reviewPayment = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const action = String(req.body.action || '').toLowerCase();
        const note = String(req.body.note || '').trim();

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action must be approve or reject' });
        }
        if (action === 'reject' && note.length < 3) {
            return res.status(400).json({ success: false, message: 'Please provide a short reject reason' });
        }

        const registration = await CategoryRegistration.findOne({
            _id: bookingId,
            category: 'sports',
            eventId: req.eventId,
        }).populate('user', 'name email phoneNumber notificationPreferences');

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }
        if (registration.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Registration is already ${registration.status}`,
            });
        }

        const event = await SportsEvent.findById(req.eventId)
            .select('title maxParticipants slug runClubId')
            .lean();
        const eventTitle = event?.title || 'your run';
        const reviewer = req.organizer?.username || req.organizer?.name || 'organizer';
        const runClubId = resolveEventRunClubId(event, req.organizer);

        if (action === 'approve') {
            const capacity = getEventCapacity(event);
            if (capacity > 0) {
                const seatsHeld = await sumSeatsHeld(req.eventId, { excludeId: registration._id });
                const people = peopleFromRegistration(registration);
                if (seatsHeld + people > capacity) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot approve — run is at capacity. Reject this registration or free a seat first.',
                    });
                }
            }
            registration.status = 'confirmed';
            registration.paymentStatus = Number(registration.amountPaid) > 0 ? 'paid' : 'free';
            registration.paymentReviewNote = note || 'Approved by organizer';
        } else {
            registration.status = 'cancelled';
            registration.paymentStatus = 'failed';
            registration.paymentReviewNote = note;
        }

        registration.paymentReviewedAt = new Date();
        registration.paymentReviewedBy = String(reviewer);
        await registration.save();

        const link = `/registration-details/${registration._id}?type=sports`;
        const leanReg = decryptRegistrationPii(
            registration.toObject ? registration.toObject() : registration,
            runClubId,
        );

        if (action === 'approve') {
            notifyRunClubParticipant({
                registration: leanReg,
                eventId: req.eventId,
                eventTitle,
                title: 'Payment approved — you’re in!',
                message: `Great news! Your payment for ${eventTitle} was approved by the organizer. Download your ticket below and join the club WhatsApp for run updates.`,
                type: 'registration',
                link,
                emailSubject: `You’re confirmed — ${eventTitle}`,
                metadata: { registrationId: String(registration._id), action: 'approve' },
                includeGroupLink: true,
                paymentContext: { status: 'paid', method: 'organizer_qr' },
            }).catch((err) => console.error('[reviewPayment.notify.approve]', err));
        } else {
            notifyRunClubParticipant({
                registration: leanReg,
                eventId: req.eventId,
                eventTitle,
                title: 'Payment not approved',
                message: `Your payment for ${eventTitle} was not approved. Reason: ${note}. You can register again with a valid screenshot.`,
                type: 'registration',
                link: '/booking',
                emailSubject: `Payment not approved — ${eventTitle}`,
                metadata: { registrationId: String(registration._id), action: 'reject', note },
                paymentContext: {
                    status: 'failed',
                    message: note
                        ? `Reason: ${note}. You can register again from My Bookings.`
                        : 'Your payment was not approved. You can register again from My Bookings.',
                },
            }).catch((err) => console.error('[reviewPayment.notify.reject]', err));
        }

        res.json({
            success: true,
            message: action === 'approve' ? 'Payment approved' : 'Registration rejected',
            registration: leanReg,
        });
    } catch (error) {
        console.error('[runClubOrganizer.reviewPayment]', error);
        res.status(500).json({ success: false, message: 'Failed to review payment' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const eventId = req.eventId;
        await expireStalePendingRegistrations(eventId);

        const event = await SportsEvent.findById(eventId)
            .select('title city eventDate status maxParticipants registration.status registrationFee distance reportingTime')
            .lean();
        if (!event) return res.status(404).json({ success: false, message: 'Run not found' });

        const today = startOfToday();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const baseFilter = { category: 'sports', eventId, status: 'confirmed' };
        const pendingFilter = { category: 'sports', eventId, status: 'pending', paymentStatus: 'pending' };
        const holdingFilter = { category: 'sports', eventId, status: { $in: ['pending', 'confirmed'] } };

        const [totalRegistrations, checkedIn, paidRegs, todayRegistrations, pendingPaymentReview, holdingRegs, pendingRegs] = await Promise.all([
            CategoryRegistration.countDocuments(baseFilter),
            CategoryRegistration.countDocuments({ ...baseFilter, checkedIn: true }),
            CategoryRegistration.find(baseFilter).select('amountPaid').lean(),
            CategoryRegistration.countDocuments({ ...baseFilter, createdAt: { $gte: today, $lt: tomorrow } }),
            CategoryRegistration.countDocuments(pendingFilter),
            CategoryRegistration.find(holdingFilter).select('bookingPeople responses').lean(),
            CategoryRegistration.find(pendingFilter).select('amountPaid').lean(),
        ]);

        const organizerRevenue = paidRegs.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
        const capacity = getEventCapacity(event);
        const seatsFilled = holdingRegs.reduce((sum, r) => sum + peopleFromRegistration(r), 0);
        const pendingAmountAtRisk = pendingRegs.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
        const seatsRemaining = capacity > 0 ? Math.max(0, capacity - seatsFilled) : null;

        res.json({
            success: true,
            event: {
                id: event._id,
                title: event.title,
                city: event.city,
                eventDate: event.eventDate,
                status: event.status,
                capacity,
                distance: event.distance || '',
                registrationStatus: event.registration?.status || 'open',
            },
            stats: {
                totalRegistrations,
                seatsFilled,
                seatsRemaining,
                capacity,
                checkedIn,
                pendingCheckIn: Math.max(0, totalRegistrations - checkedIn),
                pendingPaymentReview,
                pendingAmountAtRisk,
                pendingTtlHours: PENDING_TTL_HOURS,
                revenue: organizerRevenue,
                organizerRevenue,
                platformFees: 0,
                grossCollected: organizerRevenue,
                todayRegistrations,
            },
        });
    } catch (error) {
        console.error('[runClubOrganizer.getDashboard]', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
};

exports.listParticipants = async (req, res) => {
    try {
        const eventId = req.eventId;
        await expireStalePendingRegistrations(eventId);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const skip = (page - 1) * limit;
        const search = String(req.query.search || '').trim();
        const paymentStatus = req.query.paymentStatus;
        const checkInStatus = req.query.checkInStatus;
        const sortBy = req.query.sortBy || 'createdAt';
        let sortDir = req.query.sortDir === 'asc' ? 1 : -1;

        const filter = { category: 'sports', eventId, status: { $in: ['confirmed', 'pending'] } };

        if (paymentStatus === 'paid') {
            filter.paymentStatus = 'paid';
            filter.status = 'confirmed';
        }
        if (paymentStatus === 'free') {
            filter.paymentStatus = 'free';
            filter.status = 'confirmed';
        }
        if (paymentStatus === 'pending_review') {
            filter.status = 'pending';
            filter.paymentStatus = 'pending';
            if (req.query.sortDir === undefined) sortDir = 1; // oldest first
        }
        if (paymentStatus === 'rejected') {
            filter.status = 'cancelled';
            filter.paymentStatus = 'failed';
        }
        if (checkInStatus === 'checked_in') filter.checkedIn = true;
        if (checkInStatus === 'pending') filter.checkedIn = { $ne: true };

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const tokens = searchTokensForQuery(search);
            if (mongoose.Types.ObjectId.isValid(search)) {
                filter.$or = [{ _id: search }];
            } else {
                filter.$or = [
                    ...(tokens.length ? [{ piiSearchTokens: { $in: tokens } }] : []),
                    // Legacy plaintext rows (pre-encryption)
                    { 'responses.full_name': regex },
                    { 'responses.name': regex },
                    { 'responses.contact_no': regex },
                    { 'responses.phone': regex },
                    { 'responses.mobile': regex },
                    { 'responses.email': regex },
                ];
            }
        }

        const sortable = {
            createdAt: 'createdAt',
            name: 'responses.full_name',
            payment: 'amountPaid',
            checkIn: 'checkedInAt',
        };
        const sortKey = sortable[sortBy] || 'createdAt';

        const [registrations, total, event] = await Promise.all([
            CategoryRegistration.find(filter)
                .populate('user', 'name email phoneNumber')
                .sort({ [sortKey]: sortDir })
                .skip(skip)
                .limit(limit)
                .lean(),
            CategoryRegistration.countDocuments(filter),
            SportsEvent.findById(eventId).select('title registration.formSchema registrationFee runClubId').lean(),
        ]);

        const formSchema = event?.registration?.formSchema || [];
        const runClubId = resolveEventRunClubId(event, req.organizer);
        const decrypted = decryptManyRegistrations(registrations, runClubId);

        res.json({
            success: true,
            eventTitle: event?.title || '',
            trekName: event?.title || '',
            columns: buildSheetColumns(formSchema),
            participants: decrypted.map((r) => formatParticipantSheetRow(r, event)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('[runClubOrganizer.listParticipants]', error);
        res.status(500).json({ success: false, message: 'Failed to load participants' });
    }
};

exports.getParticipant = async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }

        const registration = await CategoryRegistration.findOne({
            _id: bookingId,
            category: 'sports',
            eventId: req.eventId,
        })
            .populate('user', 'name email phoneNumber')
            .lean();
        if (!registration) return res.status(404).json({ success: false, message: 'Participant not found' });

        const event = await SportsEvent.findById(req.eventId)
            .select('title city registration.formSchema registrationFee eventDate reportingTime runClubId')
            .lean();
        const decrypted = decryptRegistrationPii(
            registration,
            resolveEventRunClubId(event, req.organizer),
        );
        res.json({ success: true, participant: formatParticipantDetail(decrypted, event) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load participant' });
    }
};

exports.lookupParticipant = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q) return res.status(400).json({ success: false, message: 'Search query required' });

        const filter = { category: 'sports', eventId: req.eventId, status: 'confirmed' };
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const tokens = searchTokensForQuery(q);

        if (mongoose.Types.ObjectId.isValid(q)) {
            filter.$or = [{ _id: q }];
        } else {
            filter.$or = [
                ...(tokens.length ? [{ piiSearchTokens: { $in: tokens } }] : []),
                { 'responses.full_name': regex },
                { 'responses.name': regex },
                { 'responses.contact_no': regex },
                { 'responses.phone': regex },
                { 'responses.email': regex },
                { qrCodeData: regex },
            ];
        }

        const registrations = await CategoryRegistration.find(filter)
            .populate('user', 'name email phoneNumber')
            .limit(10)
            .lean();

        const event = await SportsEvent.findById(req.eventId)
            .select('title city registration.formSchema registrationFee runClubId')
            .lean();
        const runClubId = resolveEventRunClubId(event, req.organizer);
        const decrypted = decryptManyRegistrations(registrations, runClubId);

        res.json({
            success: true,
            participants: decrypted.map((r) => formatParticipantDetail(r, event)),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lookup failed' });
    }
};

exports.exportParticipants = async (req, res) => {
    try {
        const registrations = await CategoryRegistration.find({
            category: 'sports',
            eventId: req.eventId,
            status: { $in: ['confirmed', 'pending', 'cancelled'] },
        })
            .populate('user', 'name email phoneNumber')
            .sort({ createdAt: -1 })
            .lean();

        const event = await SportsEvent.findById(req.eventId)
            .select('title registration.formSchema registrationFee runClubId')
            .lean();
        const decrypted = decryptManyRegistrations(
            registrations,
            resolveEventRunClubId(event, req.organizer),
        );
        const rows = decrypted.map((r) => formatParticipantDetail(r, event));
        const csv = participantsToCsv(rows, {
            formSchema: event?.registration?.formSchema || [],
            includePaymentProof: true,
        });
        const safeName = (event?.title || 'run').replace(/[^a-z0-9-_]+/gi, '_');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_participants.csv"`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Export failed' });
    }
};

exports.checkin = async (req, res) => {
    try {
        let raw = req.body.qrData || req.body.payload || req.body.hash || req.body.bookingId;
        if (!raw) {
            return res.status(400).json({ success: false, message: 'QR data or booking ID required' });
        }
        if (mongoose.Types.ObjectId.isValid(String(raw)) && String(raw).length === 24) {
            raw = JSON.stringify({ bookingId: String(raw), type: 'sports' });
        }

        const result = await performCheckinFromRaw(raw, {
            sportEventId: req.eventId,
            allowTrek: false,
            allowSports: true,
            scannedBy: `run_club_organizer:${req.organizer.username || req.organizer.name}`,
            logToSheets: false,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('[runClubOrganizer.checkin]', error);
        res.status(500).json({ success: false, message: 'Check-in failed' });
    }
};

exports.deleteParticipant = async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }

        const registration = await CategoryRegistration.findOne({
            _id: bookingId,
            category: 'sports',
            eventId: req.eventId,
            status: 'confirmed',
        });
        if (!registration) {
            return res.status(404).json({ success: false, message: 'Participant not found' });
        }

        registration.status = 'cancelled';
        await registration.save();

        res.json({ success: true, message: 'Entry removed' });
    } catch (error) {
        console.error('[runClubOrganizer.deleteParticipant]', error);
        res.status(500).json({ success: false, message: 'Failed to delete entry' });
    }
};

exports.resendConfirmation = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const registration = await CategoryRegistration.findOne({
            _id: bookingId,
            category: 'sports',
            eventId: req.eventId,
        })
            .populate('user', 'name email notificationPreferences')
            .lean();
        if (!registration) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (registration.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'Confirmation can only be sent for approved registrations',
            });
        }

        const event = await SportsEvent.findById(req.eventId).select('title runClubId').lean();
        const eventTitle = event?.title || 'your run';
        const link = `/registration-details/${bookingId}?type=sports`;
        const title = 'Run Registration Confirmed';
        const decrypted = decryptRegistrationPii(
            registration,
            resolveEventRunClubId(event, req.organizer),
        );

        const result = await notifyRunClubParticipant({
            registration: decrypted,
            eventId: req.eventId,
            eventTitle,
            title,
            message: `Your registration for ${eventTitle} is confirmed. Download your ticket and join WhatsApp for run updates.`,
            type: 'registration',
            link,
            emailSubject: `Run registration confirmed — ${eventTitle}`,
            metadata: { registrationId: bookingId, resentBy: 'run_club_organizer' },
            includeGroupLink: true,
            paymentContext: {
                status: Number(registration.amountPaid) > 0 ? 'paid' : 'free',
            },
        });

        if (!result.inApp && !result.push && !result.email) {
            return res.status(400).json({
                success: false,
                message: 'No email or linked account found for this participant',
            });
        }

        res.json({
            success: true,
            message: 'Confirmation resent',
            delivery: { inApp: result.inApp, push: result.push, email: result.email },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to resend confirmation' });
    }
};

exports.sendReminder = async (req, res) => {
    try {
        const event = await SportsEvent.findById(req.eventId)
            .select('title meetingPoint reportingTime venue')
            .lean();
        if (!event) return res.status(404).json({ success: false, message: 'Run not found' });

        const title = String(req.body.title || `Reminder: ${event.title}`).trim();
        const message = String(
            req.body.message ||
                'Your run is coming up soon. Please arrive on time with your QR ticket.',
        ).trim();

        const stats = await notifyRunClubParticipants({
            eventId: req.eventId,
            eventTitle: event.title,
            title,
            message,
            type: 'reminder',
            link: `/sports/run/${req.eventId}`,
            emailSubject: title,
            metadata: { source: 'run_club_organizer' },
        });

        res.json({
            success: true,
            message: `Reminder sent to ${stats.participants} participants`,
            sent: stats.inApp,
            delivery: stats,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send reminder' });
    }
};

exports.broadcastAnnouncement = async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const message = String(req.body.message || '').trim();
        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        const event = await SportsEvent.findById(req.eventId).select('title').lean();

        const stats = await notifyRunClubParticipants({
            eventId: req.eventId,
            eventTitle: event?.title || 'Run',
            title,
            message,
            type: 'announcement',
            link: `/sports/run/${req.eventId}`,
            emailSubject: title,
            metadata: { source: 'run_club_organizer_broadcast' },
        });

        res.json({
            success: true,
            message: `Announcement sent to ${stats.participants} participants`,
            sent: stats.inApp,
            delivery: stats,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to broadcast announcement' });
    }
};

/** Notify a single confirmed participant (in-app + push + email). */
exports.notifyParticipant = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const title = String(req.body.title || '').trim();
        const message = String(req.body.message || '').trim();
        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }
        if (title.length > 120 || message.length > 2000) {
            return res.status(400).json({ success: false, message: 'Title or message is too long' });
        }

        const registration = await CategoryRegistration.findOne({
            _id: bookingId,
            category: 'sports',
            eventId: req.eventId,
        })
            .populate('user', 'name email notificationPreferences')
            .lean();
        if (!registration) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (registration.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'You can only message confirmed participants',
            });
        }

        const event = await SportsEvent.findById(req.eventId).select('title runClubId').lean();
        const eventTitle = event?.title || 'your run';
        const decrypted = decryptRegistrationPii(
            registration,
            resolveEventRunClubId(event, req.organizer),
        );

        const result = await notifyRunClubParticipant({
            registration: decrypted,
            eventId: req.eventId,
            eventTitle,
            title,
            message,
            type: 'announcement',
            link: `/registration-details/${bookingId}?type=sports`,
            emailSubject: title,
            metadata: {
                registrationId: bookingId,
                source: 'run_club_organizer_individual',
            },
        });

        if (!result.inApp && !result.push && !result.email) {
            return res.status(400).json({
                success: false,
                message: 'No email or linked account found for this participant',
            });
        }

        res.json({
            success: true,
            message: 'Message sent',
            delivery: { inApp: result.inApp, push: result.push, email: result.email },
        });
    } catch (error) {
        console.error('[runClubOrganizer.notifyParticipant]', error);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
};

exports.getCheckinStats = async (req, res) => {
    try {
        const event = await SportsEvent.findById(req.eventId).select('title city').lean();
        const baseFilter = { category: 'sports', eventId: req.eventId, status: 'confirmed' };
        const [totalRegistered, totalCheckedIn] = await Promise.all([
            CategoryRegistration.countDocuments(baseFilter),
            CategoryRegistration.countDocuments({ ...baseFilter, checkedIn: true }),
        ]);

        res.json({
            success: true,
            eventId: req.eventId,
            trekName: event?.title,
            eventTitle: event?.title,
            city: event?.city,
            totalRegistered,
            totalCheckedIn,
            checkinRate: totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load check-in stats' });
    }
};
