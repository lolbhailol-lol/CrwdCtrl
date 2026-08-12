const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const EventShowOrganizerAccount = require('../model/event_show_organizer_account_model');
const EventShow = require('../model/event_show_model');
const EventShowRegistration = require('../model/event_show_registration_model');
const EventShowManagerProfileInvite = require('../model/event_show_manager_profile_invite_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { performCheckinFromRaw } = require('../services/checkinService');
const {
    normalizeUsername,
    getOrganizerEvents,
} = require('../utils/eventShowOrganizerAccess');
const { createNotification } = require('./notificationController');

const TOKEN_TTL = process.env.EVENT_ORGANIZER_JWT_TTL || '30d';

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function responsesToObject(responses) {
    if (!responses) return {};
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses.toObject === 'function') return responses.toObject();
    return { ...responses };
}

function formatEvent(event) {
    if (!event) return null;
    const plain = typeof event.toObject === 'function' ? event.toObject() : event;
    return {
        ...plain,
        id: String(plain._id),
        _id: String(plain._id),
        title: plain.displayName || plain.title || 'Event',
        registrationStatus: plain.registration?.status || 'closed',
        registrationMode: plain.registration?.mode || '',
    };
}

function isDriveOnlyTierName(name) {
    return /drive\s*only|independence\s*day\s*drive\s*only/i.test(String(name || ''));
}

function isSpectatorTier(reg = {}) {
    if (/tier_spectator/i.test(String(reg.tierId || ''))) return true;
    return /\bspectator/i.test(String(reg.tierName || ''));
}

function resolveRegistrationCategory(reg, responses = {}) {
    const explicit = String(
        responses.registration_type
        || reg.registrationType
        || '',
    ).trim().toLowerCase();
    if (explicit === 'spectator' || isSpectatorTier(reg)) {
        return 'spectator';
    }
    if (['drive_only', 'drive_and_trackday', 'trackday_only'].includes(explicit)) {
        return explicit;
    }

    const tierName = String(reg.tierName || '').trim();
    if (isDriveOnlyTierName(tierName) || /tier_drive_only/i.test(String(reg.tierId || ''))) {
        return 'drive_only';
    }

    const joinDrive = String(
        responses.join_drive
        || responses.join_independence_day_drive
        || responses.independence_day_drive
        || '',
    ).trim().toLowerCase();
    const joinsDrive = joinDrive === 'yes'
        || /drive only/i.test(joinDrive)
        || /drive \+ trackday|drive and trackday/i.test(joinDrive);

    if (joinsDrive) return 'drive_and_trackday';
    if (joinDrive === 'no' || /trackday only/i.test(joinDrive)) return 'trackday_only';
    // Paid track packages without a drive answer → trackday
    if (tierName && !isDriveOnlyTierName(tierName)) return 'trackday_only';
    return 'unknown';
}

function categoryLabel(category) {
    if (category === 'drive_only') return 'Independence Day Drive only';
    if (category === 'drive_and_trackday') return 'Drive + Trackday';
    if (category === 'trackday_only') return 'Trackday only';
    if (category === 'spectator') return 'Spectator';
    return 'Other';
}

/** Build a simple driver list from registration responses (solo + group packages). */
function extractDrivers(responses = {}) {
    const src = responsesToObject(responses);
    const byIndex = new Map();

    const upsert = (index, patch) => {
        const i = Math.max(1, Number(index) || 1);
        const prev = byIndex.get(i) || { index: i, name: '', email: '', phone: '', bloodGroup: '' };
        byIndex.set(i, {
            index: i,
            name: patch.name !== undefined && patch.name !== '' ? patch.name : prev.name,
            email: patch.email !== undefined && patch.email !== '' ? patch.email : prev.email,
            phone: patch.phone !== undefined && patch.phone !== '' ? patch.phone : prev.phone,
            bloodGroup: patch.bloodGroup !== undefined && patch.bloodGroup !== ''
                ? patch.bloodGroup
                : prev.bloodGroup,
        });
    };

    // Driver 1 — primary form fields
    upsert(1, {
        name: String(src.leader_name || src.full_name || src.name || '').trim(),
        email: String(src.email || '').trim(),
        phone: String(src.phone || src.contact_no || src.mobile || '').trim(),
        bloodGroup: String(src.blood_group || '').trim(),
    });

    // driver_N_* (group packages)
    for (const [key, raw] of Object.entries(src)) {
        const m = /^driver_(\d+)_(name|email|phone|blood_group)$/i.exec(String(key));
        if (!m) continue;
        const index = Number(m[1]);
        const field = String(m[2]).toLowerCase();
        const value = String(raw || '').trim();
        if (field === 'name') upsert(index, { name: value });
        else if (field === 'email') upsert(index, { email: value });
        else if (field === 'phone') upsert(index, { phone: value });
        else if (field === 'blood_group') upsert(index, { bloodGroup: value });
    }

    return [...byIndex.values()]
        .sort((a, b) => a.index - b.index)
        .filter((d) => d.name || d.email || d.phone || d.bloodGroup);
}

function formatParticipant(reg) {
    const responses = responsesToObject(reg.responses);
    const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
    const formName = String(
        responses.leader_name
        || responses.full_name
        || responses.name
        || '',
    ).trim();
    const formEmail = String(responses.email || '').trim();
    const formPhone = String(
        responses.phone
        || responses.contact_no
        || responses.mobile
        || '',
    ).trim();
    const category = resolveRegistrationCategory(reg, responses);
    const drivers = extractDrivers(responses);
    const additionalEntries = Array.isArray(reg.additionalEntries)
        ? reg.additionalEntries.map((entry) => {
            const entryResponses = entry?.responses && typeof entry.responses === 'object'
                ? (entry.responses instanceof Map
                    ? Object.fromEntries(entry.responses)
                    : entry.responses)
                : {};
            return {
                id: entry._id ? String(entry._id) : null,
                tierId: entry.tierId || null,
                tierName: entry.tierName || null,
                amountPaid: Number(entry.amountPaid) || 0,
                paymentStatus: entry.paymentStatus || 'free',
                payment_gateway: entry.payment_gateway || null,
                paymentScreenshotUrl: entry.paymentScreenshotUrl || '',
                transactionId: entry.transactionId || '',
                payment_order_id: entry.payment_order_id || null,
                payment_id: entry.payment_id || null,
                status: entry.status || 'pending',
                submittedAt: entry.submittedAt || null,
                responses: entryResponses,
                drivers: extractDrivers(entryResponses),
            };
        })
        : [];
    const reRegistrationCount = Number(reg.reRegistrationCount) || additionalEntries.length || 0;
    const addOnPaid = additionalEntries.reduce((sum, e) => sum + (Number(e.amountPaid) || 0), 0);
    // amountPaid on doc is already a running total after merge; fall back to primary+addons
    const totalAmountPaid = Number(reg.amountPaid) || 0;
    const primaryAmount = Math.max(0, totalAmountPaid - addOnPaid);
    const allTier = [
        reg.tierName || null,
        ...additionalEntries.map((e) => e.tierName).filter(Boolean),
    ].filter(Boolean);
    const repeatLabel = reRegistrationCount > 0
        ? `Registered again · +${reRegistrationCount}`
        : null;

    return {
        id: String(reg._id),
        status: reg.status,
        paymentStatus: reg.paymentStatus || 'free',
        amountPaid: totalAmountPaid,
        totalAmountPaid,
        primaryAmountPaid: primaryAmount,
        tierId: reg.tierId || null,
        tierName: reg.tierName || null,
        allTier,
        additionalEntries,
        reRegistrationCount,
        repeatLabel,
        checkedIn: Boolean(reg.checkedIn),
        checkedInAt: reg.checkedInAt || null,
        // Prefer form answers (leader / registrant) over account profile
        userName: formName || user?.name || '',
        userEmail: formEmail || user?.email || '',
        userPhone: formPhone || user?.phone || user?.phoneNumber || '',
        joinDrive: String(
            responses.join_drive
            || responses.join_independence_day_drive
            || responses.independence_day_drive
            || '',
        ).trim(),
        registrationType: String(responses.registration_type || category || '').trim(),
        category,
        categoryLabel: categoryLabel(category),
        joinsIndependenceDrive: category === 'drive_only'
            || category === 'drive_and_trackday'
            || (category === 'spectator' && /^yes$/i.test(String(
                responses.join_drive
                || responses.join_independence_day_drive
                || responses.independence_day_drive
                || '',
            ))),
        hasTrackday: category === 'drive_and_trackday' || category === 'trackday_only',
        isSpectator: category === 'spectator',
        bloodGroup: String(responses.blood_group || '').trim(),
        vehicleDetails: String(responses.vehicle_details || responses.vehicle || '').trim(),
        driverCount: responses.driver_count != null && responses.driver_count !== ''
            ? Number(responses.driver_count) || String(responses.driver_count)
            : (drivers.length || null),
        drivers,
        submittedAt: reg.submittedAt || reg.createdAt,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
        qrCodeData: reg.qrCodeData || null,
        payment_id: reg.payment_id || null,
        payment_order_id: reg.payment_order_id || null,
        payment_gateway: reg.payment_gateway || null,
        paymentScreenshotUrl: reg.paymentScreenshotUrl || '',
        transactionId: reg.transactionId || '',
        selectedAddOns: Array.isArray(reg.selectedAddOns) ? reg.selectedAddOns : [],
        manualEntry: /^(yes|true|1)$/i.test(String(responses.manual_entry || responses.added_by_organizer || '')),
        responses,
    };
}

function csvEscape(value) {
    const s = String(value ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

async function buildAuthResponse(organizer) {
    organizer.lastLoginAt = new Date();
    if (!organizer.status) organizer.status = 'approved';
    await organizer.save();

    const token = jwt.sign(
        {
            organizerId: organizer._id,
            role: 'event_organizer',
            username: organizer.username,
        },
        getJwtSecret(),
        { expiresIn: TOKEN_TTL },
    );

    const events = (await getOrganizerEvents(organizer)).map(formatEvent);

    return {
        success: true,
        token,
        organizer: {
            id: organizer._id,
            name: organizer.name || '',
            username: organizer.username,
            email: organizer.email || '',
            phone: organizer.phone || '',
            status: EventShowOrganizerAccount.effectiveStatus(organizer),
            assignedEventShowIds: organizer.assignedEventShowIds || [],
        },
        events,
    };
}

/** Published events for signup dropdown (id + title only). */
exports.listSignupEvents = async (req, res) => {
    try {
        const events = await EventShow.find({ status: 'published' })
            .select('title displayName startDate')
            .sort({ startDate: -1, createdAt: -1 })
            .limit(300)
            .lean();
        res.json({
            success: true,
            events: events.map((e) => ({
                id: e._id,
                title: e.displayName || e.title || 'Event',
            })),
        });
    } catch (error) {
        console.error('[eventShowOrganizer.listSignupEvents]', error);
        res.status(500).json({ success: false, message: 'Failed to load events' });
    }
};

/**
 * Consumer Profile sidebar eligibility for Event organizer.
 * Eligible if profile-invite exists OR approved organizer account exists for same email.
 */
exports.profileEligible = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.json({ success: true, eligible: false });
        const User = require('../model/usermodel');
        const user = await User.findById(userId).select('email').lean();
        const email = String(user?.email || '').trim().toLowerCase();
        if (!email) return res.json({ success: true, eligible: false });

        let invite = await EventShowManagerProfileInvite.findOne({ email, isActive: true })
            .select('_id')
            .lean();
        if (!invite) {
            invite = await EventShowManagerProfileInvite.findOne({
                email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                isActive: true,
            }).select('_id').lean();
        }
        if (invite) return res.json({ success: true, eligible: true });

        const organizers = await EventShowOrganizerAccount.find({
            $or: [
                { email },
                { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            ],
        }).lean();
        const approved = organizers.some((org) => EventShowOrganizerAccount.canLogin(org));
        return res.json({ success: true, eligible: approved });
    } catch (error) {
        console.error('[eventShowOrganizer.profileEligible]', error);
        res.status(500).json({ success: false, eligible: false, message: 'Failed to check access' });
    }
};

/** Signed-in CrwdCtrl user -> event organizer session if approved account exists for same email. */
exports.appSession = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Sign in to CrwdCtrl first' });
        }
        const User = require('../model/usermodel');
        const user = await User.findById(userId).select('email').lean();
        const email = String(user?.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(403).json({
                success: false,
                message: 'Add an email to your CrwdCtrl account to use Event organizer',
            });
        }

        const organizers = await EventShowOrganizerAccount.find({
            $or: [
                { email },
                { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            ],
        }).sort({ updatedAt: -1 });
        const organizer = organizers.find((org) => EventShowOrganizerAccount.canLogin(org));
        if (!organizer) {
            return res.status(403).json({
                success: false,
                code: 'no_organizer_account',
                message: 'No approved event organizer account for this email. Create one or sign in with your organizer username and password.',
            });
        }

        res.json(await buildAuthResponse(organizer));
    } catch (error) {
        console.error('[eventShowOrganizer.appSession]', error);
        res.status(500).json({ success: false, message: 'Failed to open event organizer session' });
    }
};

exports.signup = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const eventShowId = String(req.body.eventShowId || '').trim();

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required — use the same email CrwdCtrl approved for Event organizer access',
            });
        }
        if (username.length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        if (!mongoose.Types.ObjectId.isValid(eventShowId)) {
            return res.status(400).json({ success: false, message: 'Select a valid event' });
        }

        const invite = await EventShowManagerProfileInvite.findOne({ email, isActive: true })
            .select('_id')
            .lean();
        if (!invite) {
            return res.status(403).json({
                success: false,
                code: 'invite_required',
                message: 'This email is not approved for event organizer signup. Ask CrwdCtrl to add your email under Admin → Event Organizers → Profile emails first.',
            });
        }

        const event = await EventShow.findOne({ _id: eventShowId, status: 'published' })
            .select('_id title displayName')
            .lean();
        if (!event) {
            return res.status(400).json({ success: false, message: 'Event not found or not published yet' });
        }

        const existing = await EventShowOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }

        const organizer = await EventShowOrganizerAccount.create({
            name,
            username,
            email,
            passwordHash: await EventShowOrganizerAccount.hashPassword(password),
            phone,
            assignedEventShowIds: [eventShowId],
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
                eventShowId,
                eventTitle: event.displayName || event.title || 'Event',
            },
        });
    } catch (error) {
        console.error('[eventShowOrganizer.signup]', error);
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

        const organizer = await EventShowOrganizerAccount.findOne({
            $or: [{ username }, { email: username }],
        });
        if (!organizer) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await organizer.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const status = EventShowOrganizerAccount.effectiveStatus(organizer);
        if (status === 'pending') {
            return res.status(403).json({
                success: false,
                code: 'pending_approval',
                message: 'Account awaiting CrwdCtrl approval.',
            });
        }
        if (status === 'rejected') {
            return res.status(403).json({
                success: false,
                code: 'rejected',
                message: organizer.rejectedReason
                    ? `Access was not approved: ${organizer.rejectedReason}`
                    : 'Access was not approved. Contact CrwdCtrl.',
            });
        }
        if (!organizer.isActive) {
            return res.status(403).json({
                success: false,
                code: 'inactive',
                message: 'This organizer account is deactivated.',
            });
        }

        res.json(await buildAuthResponse(organizer));
    } catch (error) {
        console.error('[eventShowOrganizer.login]', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const events = (await getOrganizerEvents(req.organizer)).map(formatEvent);
        res.json({
            success: true,
            organizer: {
                id: req.organizer._id,
                name: req.organizer.name || '',
                username: req.organizer.username,
                email: req.organizer.email || '',
                phone: req.organizer.phone || '',
                status: EventShowOrganizerAccount.effectiveStatus(req.organizer),
                assignedEventShowIds: req.organizer.assignedEventShowIds || [],
            },
            events,
        });
    } catch (error) {
        console.error('[eventShowOrganizer.getMe]', error);
        res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
};

exports.listEvents = async (req, res) => {
    try {
        const events = (await getOrganizerEvents(req.organizer)).map(formatEvent);
        res.json({ success: true, events });
    } catch (error) {
        console.error('[eventShowOrganizer.listEvents]', error);
        res.status(500).json({ success: false, message: 'Failed to list events' });
    }
};

exports.getEvent = async (req, res) => {
    try {
        const event = await EventShow.findById(req.eventShowId).lean();
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, event: formatEvent(event) });
    } catch (error) {
        console.error('[eventShowOrganizer.getEvent]', error);
        res.status(500).json({ success: false, message: 'Failed to load event' });
    }
};

exports.setRegistrationStatus = async (req, res) => {
    try {
        const status = String(req.body.status || '').toLowerCase();
        if (!['open', 'closed'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be open or closed' });
        }
        const event = await EventShow.findById(req.eventShowId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (!event.registration) event.registration = {};
        event.registration.status = status;
        await event.save();
        res.json({
            success: true,
            message: status === 'open' ? 'Registration opened' : 'Registration closed',
            event: formatEvent(event),
        });
    } catch (error) {
        console.error('[eventShowOrganizer.setRegistrationStatus]', error);
        res.status(500).json({ success: false, message: 'Failed to update registration status' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const eventShowId = req.eventShowId;
        const event = await EventShow.findById(eventShowId).lean();
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        const oid = new mongoose.Types.ObjectId(eventShowId);
        const [
            totalRegistrations,
            pendingRegistrations,
            rejectedRegistrations,
            checkedIn,
            todayRegistrations,
            paidRegs,
            paymentBreakdown,
            tierBreakdown,
            recentRegs,
            approvedForSegments,
            qrStatsRows,
            qrPaidAmountRows,
        ] = await Promise.all([
            EventShowRegistration.countDocuments({ eventShow: oid, status: 'approved' }),
            EventShowRegistration.countDocuments({ eventShow: oid, status: 'pending' }),
            EventShowRegistration.countDocuments({ eventShow: oid, status: 'rejected' }),
            EventShowRegistration.countDocuments({ eventShow: oid, status: 'approved', checkedIn: true }),
            EventShowRegistration.countDocuments({
                eventShow: oid,
                createdAt: { $gte: startOfToday() },
            }),
            EventShowRegistration.find({
                eventShow: oid,
                status: 'approved',
                paymentStatus: { $in: ['paid', 'free'] },
            }).select('amountPaid').lean(),
            EventShowRegistration.aggregate([
                { $match: { eventShow: oid } },
                {
                    $group: {
                        _id: { $ifNull: ['$paymentStatus', 'unknown'] },
                        count: { $sum: 1 },
                        amount: { $sum: { $ifNull: ['$amountPaid', 0] } },
                    },
                },
            ]),
            EventShowRegistration.aggregate([
                { $match: { eventShow: oid, status: { $in: ['pending', 'approved'] } } },
                {
                    $group: {
                        _id: {
                            tierId: { $ifNull: ['$tierId', ''] },
                            tierName: { $ifNull: ['$tierName', ''] },
                        },
                        count: { $sum: 1 },
                        paid: {
                            $sum: {
                                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0],
                            },
                        },
                        revenue: {
                            $sum: {
                                $cond: [
                                    { $in: ['$paymentStatus', ['paid', 'free']] },
                                    { $ifNull: ['$amountPaid', 0] },
                                    0,
                                ],
                            },
                        },
                    },
                },
                { $sort: { count: -1 } },
            ]),
            EventShowRegistration.find({ eventShow: oid })
                .populate('user', 'name email phone')
                .sort({ createdAt: -1 })
                .limit(8)
                .lean(),
            EventShowRegistration.find({ eventShow: oid, status: 'approved' })
                .select('tierId tierName amountPaid paymentStatus responses')
                .lean(),
            EventShowRegistration.aggregate([
                { $match: { eventShow: oid, payment_gateway: 'organizer_qr' } },
                {
                    $group: {
                        _id: null,
                        totalQr: { $sum: 1 },
                        pendingReview: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ['$status', 'pending'] },
                                            { $eq: ['$paymentStatus', 'pending'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        paidApproved: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'approved'] },
                                            { $eq: ['$paymentStatus', 'paid'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        withProof: {
                            $sum: {
                                $cond: [
                                    {
                                        $gt: [{ $strLenCP: { $ifNull: ['$paymentScreenshotUrl', ''] } }, 0],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),
            EventShowRegistration.aggregate([
                {
                    $match: {
                        eventShow: oid,
                        payment_gateway: 'organizer_qr',
                        status: 'approved',
                        paymentStatus: 'paid',
                    },
                },
                {
                    $project: {
                        amountPaid: { $ifNull: ['$amountPaid', 0] },
                        payment_order_id: { $ifNull: ['$payment_order_id', ''] },
                        payment_id: { $ifNull: ['$payment_id', ''] },
                        transactionId: { $ifNull: ['$transactionId', ''] },
                    },
                },
                {
                    $addFields: {
                        _payRef: {
                            $cond: [
                                { $gt: [{ $strLenCP: '$payment_order_id' }, 0] },
                                { $concat: ['order:', '$payment_order_id'] },
                                {
                                    $cond: [
                                        { $gt: [{ $strLenCP: '$payment_id' }, 0] },
                                        { $concat: ['pay:', '$payment_id'] },
                                        {
                                            $cond: [
                                                { $gt: [{ $strLenCP: '$transactionId' }, 0] },
                                                { $concat: ['txn:', '$transactionId'] },
                                                null,
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
                // Deduplicate multi-submit rows for the same payment reference
                {
                    $group: {
                        _id: '$_payRef',
                        amount: { $max: '$amountPaid' },
                        rowCount: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: null,
                        amount: { $sum: '$amount' },
                        count: { $sum: 1 },
                        duplicateRows: {
                            $sum: {
                                $cond: [{ $gt: ['$rowCount', 1] }, { $subtract: ['$rowCount', 1] }, 0],
                            },
                        },
                    },
                },
            ]),
        ]);

        const revenue = paidRegs.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
        const payments = { free: 0, pending: 0, paid: 0, failed: 0, unknown: 0, paidAmount: 0 };
        for (const row of paymentBreakdown) {
            const key = String(row._id || 'unknown');
            if (Object.prototype.hasOwnProperty.call(payments, key)) {
                payments[key] = Number(row.count) || 0;
            } else {
                payments.unknown += Number(row.count) || 0;
            }
            if (key === 'paid') payments.paidAmount = Number(row.amount) || 0;
        }

        const segments = {
            driveOnly: 0,
            driveAndTrackday: 0,
            trackdayOnly: 0,
            spectator: 0,
            unknown: 0,
            independenceDriveTotal: 0,
            trackdayTotal: 0,
        };
        for (const reg of approvedForSegments) {
            const p = formatParticipant(reg);
            if (p.category === 'drive_only') segments.driveOnly += 1;
            else if (p.category === 'drive_and_trackday') segments.driveAndTrackday += 1;
            else if (p.category === 'trackday_only') segments.trackdayOnly += 1;
            else if (p.category === 'spectator') segments.spectator += 1;
            else segments.unknown += 1;
            if (p.joinsIndependenceDrive) segments.independenceDriveTotal += 1;
            if (p.hasTrackday) segments.trackdayTotal += 1;
        }

        const qrAgg = qrStatsRows[0] || {};
        const qrPaidAgg = qrPaidAmountRows[0] || {};
        const commissionPercent = 2.5;
        const commissionBase = Number(qrPaidAgg.amount) || 0;
        const commissionDue = Math.round((commissionBase * (commissionPercent / 100)) * 100) / 100;
        const qrStats = {
            totalQr: Number(qrAgg.totalQr) || 0,
            pendingReview: Number(qrAgg.pendingReview) || 0,
            paidApproved: Number(qrAgg.paidApproved) || 0,
            withProof: Number(qrAgg.withProof) || 0,
            enabled: (event?.registration?.mode || '') === 'organizer_qr',
            paidAmount: commissionBase,
            commissionPercent,
            commissionDue,
            commissionEntries: Number(qrPaidAgg.count) || 0,
            duplicateRows: Number(qrPaidAgg.duplicateRows) || 0,
        };

        const driveTiers = [];
        const trackdayTiers = [];
        for (const row of tierBreakdown) {
            const entry = {
                tierId: row._id?.tierId || null,
                tierName: row._id?.tierName || 'No package',
                count: Number(row.count) || 0,
                paid: Number(row.paid) || 0,
                revenue: Number(row.revenue) || 0,
            };
            if (isDriveOnlyTierName(entry.tierName) || /tier_drive_only/i.test(String(entry.tierId || ''))) {
                driveTiers.push(entry);
            } else {
                trackdayTiers.push(entry);
            }
        }

        res.json({
            success: true,
            event: formatEvent(event),
            stats: {
                totalRegistrations,
                pendingRegistrations,
                rejectedRegistrations,
                checkedIn,
                pendingCheckIn: Math.max(0, totalRegistrations - checkedIn),
                checkInRate: totalRegistrations > 0
                    ? Math.round((checkedIn / totalRegistrations) * 100)
                    : 0,
                revenue,
                todayRegistrations,
                payments,
                segments,
                qr: qrStats,
            },
            tiers: tierBreakdown.map((row) => ({
                tierId: row._id?.tierId || null,
                tierName: row._id?.tierName || 'No package',
                count: Number(row.count) || 0,
                paid: Number(row.paid) || 0,
                revenue: Number(row.revenue) || 0,
            })),
            driveTiers,
            trackdayTiers,
            recent: recentRegs.map(formatParticipant),
        });
    } catch (error) {
        console.error('[eventShowOrganizer.getDashboard]', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
};

exports.listParticipants = async (req, res) => {
    try {
        const eventShowId = req.eventShowId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const skip = (page - 1) * limit;
        const search = String(req.query.search || '').trim();
        const status = String(req.query.status || '').trim();
        const paymentStatus = String(req.query.paymentStatus || '').trim();
        const checkInStatus = String(req.query.checkInStatus || '').trim();
        const tierId = String(req.query.tierId || '').trim();
        const category = String(req.query.category || '').trim().toLowerCase();

        const filter = { eventShow: eventShowId };
        if (['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
        if (['free', 'pending', 'paid', 'failed'].includes(paymentStatus)) {
            filter.paymentStatus = paymentStatus;
        }
        if (checkInStatus === 'checked_in') filter.checkedIn = true;
        if (checkInStatus === 'not_checked_in') filter.checkedIn = { $ne: true };
        if (tierId) filter.tierId = tierId;

        let regs = await EventShowRegistration.find(filter)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        let formatted = regs.map(formatParticipant);
        if (['drive_only', 'drive_and_trackday', 'trackday_only', 'independence_drive', 'trackday', 'spectator'].includes(category)) {
            formatted = formatted.filter((p) => {
                if (category === 'independence_drive') return p.joinsIndependenceDrive;
                if (category === 'trackday') return p.hasTrackday;
                return p.category === category;
            });
        }

        if (search) {
            const q = search.toLowerCase();
            formatted = formatted.filter((p) => {
                const responseBlob = Object.values(p.responses || {})
                    .map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')))
                    .join(' ');
                const driversBlob = (p.drivers || [])
                    .map((d) => [d.name, d.email, d.phone, d.bloodGroup].filter(Boolean).join(' '))
                    .join(' ');
                const extrasBlob = (p.additionalEntries || [])
                    .flatMap((e) => [
                        e.tierName,
                        ...(e.drivers || []).map((d) => [d.name, d.email, d.phone, d.bloodGroup].filter(Boolean).join(' ')),
                    ])
                    .join(' ');
                return [
                    p.userName,
                    p.userEmail,
                    p.userPhone,
                    p.tierName,
                    p.joinDrive,
                    p.categoryLabel,
                    p.bloodGroup,
                    p.vehicleDetails,
                    String(p.id),
                    driversBlob,
                    extrasBlob,
                    responseBlob,
                ]
                    .join(' ')
                    .toLowerCase()
                    .includes(q);
            });
        }

        const total = formatted.length;
        const pageRows = formatted.slice(skip, skip + limit);

        res.json({
            success: true,
            participants: pageRows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.max(1, Math.ceil(total / limit)),
            },
        });
    } catch (error) {
        console.error('[eventShowOrganizer.listParticipants]', error);
        res.status(500).json({ success: false, message: 'Failed to list participants' });
    }
};

exports.getParticipant = async (req, res) => {
    try {
        const reg = await EventShowRegistration.findOne({
            _id: req.params.registrationId,
            eventShow: req.eventShowId,
        })
            .populate('user', 'name email phone')
            .lean();
        if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
        res.json({ success: true, participant: formatParticipant(reg) });
    } catch (error) {
        console.error('[eventShowOrganizer.getParticipant]', error);
        res.status(500).json({ success: false, message: 'Failed to load participant' });
    }
};

exports.updateParticipantStatus = async (req, res) => {
    try {
        const status = String(req.body.status || '').toLowerCase();
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const reg = await EventShowRegistration.findOne({
            _id: req.params.registrationId,
            eventShow: req.eventShowId,
        });
        if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

        const entryId = req.body.entryId ? String(req.body.entryId) : '';
        const entryIndex = req.body.entryIndex != null && req.body.entryIndex !== ''
            ? Number(req.body.entryIndex)
            : null;

        if (entryId || (Number.isInteger(entryIndex) && entryIndex >= 0)) {
            const entries = reg.additionalEntries || [];
            let entry = null;
            if (entryId) {
                entry = entries.id(entryId) || entries.find((e) => String(e._id) === entryId);
            } else if (entryIndex < entries.length) {
                entry = entries[entryIndex];
            }
            if (!entry) {
                return res.status(404).json({ success: false, message: 'Additional registration entry not found' });
            }
            entry.status = status;
            if (status === 'approved' && entry.paymentStatus === 'pending') {
                entry.paymentStatus = 'paid';
            }
            if (status === 'rejected' && entry.paymentStatus === 'pending') {
                entry.paymentStatus = 'failed';
            }
            // If any add-on is still pending proof, keep primary as-is; if approving add-on and primary was pending, approve primary too
            if (status === 'approved' && reg.status === 'pending') {
                reg.status = 'approved';
            }
        } else {
            reg.status = status;
            if (status === 'approved' && reg.paymentStatus === 'pending') {
                reg.paymentStatus = 'paid';
            }
            if (status === 'rejected' && reg.paymentStatus === 'pending') {
                reg.paymentStatus = 'failed';
            }
        }

        await reg.save();
        const populated = await EventShowRegistration.findById(reg._id)
            .populate('user', 'name email phone')
            .lean();
        res.json({
            success: true,
            message: `Registration ${status}`,
            participant: formatParticipant(populated),
        });
    } catch (error) {
        console.error('[eventShowOrganizer.updateParticipantStatus]', error);
        res.status(500).json({ success: false, message: 'Failed to update registration' });
    }
};

exports.deleteParticipant = async (req, res) => {
    try {
        const deleted = await EventShowRegistration.findOneAndDelete({
            _id: req.params.registrationId,
            eventShow: req.eventShowId,
        });
        if (!deleted) return res.status(404).json({ success: false, message: 'Registration not found' });
        res.json({ success: true, message: 'Registration deleted' });
    } catch (error) {
        console.error('[eventShowOrganizer.deleteParticipant]', error);
        res.status(500).json({ success: false, message: 'Failed to delete registration' });
    }
};

/**
 * Walk-in / desk entry: organizer fills the same registration form fields manually.
 */
exports.createManualParticipant = async (req, res) => {
    try {
        const crypto = require('crypto');
        const User = require('../model/usermodel');
        const {
            resolveSportsPerPersonFee,
            resolveEventAddOns,
            getSportsTiers,
        } = require('../utils/sportsPricing');

        const event = await EventShow.findById(req.eventShowId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        let responses = req.body.responses;
        if (typeof responses === 'string') {
            try {
                responses = JSON.parse(responses);
            } catch {
                return res.status(400).json({ success: false, message: 'Invalid responses' });
            }
        }
        if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
            responses = {};
        }

        const cleanResponses = {};
        Object.entries(responses).forEach(([key, value]) => {
            const k = String(key || '').trim();
            if (!k || k.startsWith('_')) return;
            if (value == null) return;
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed) cleanResponses[k] = trimmed;
                return;
            }
            if (typeof value === 'number' || typeof value === 'boolean') {
                cleanResponses[k] = value;
                return;
            }
            if (Array.isArray(value)) {
                cleanResponses[k] = value;
            }
        });

        const name = String(
            cleanResponses.name
            || cleanResponses.full_name
            || cleanResponses.leader_name
            || req.body.name
            || '',
        ).trim();
        const email = String(cleanResponses.email || req.body.email || '').trim().toLowerCase();
        const phone = String(
            cleanResponses.phone
            || cleanResponses.contact_no
            || cleanResponses.mobile
            || req.body.phone
            || '',
        ).trim().replace(/\s+/g, '');

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'Email or phone is required' });
        }

        let tierId = String(req.body.tierId || cleanResponses.tier_id || '').trim();
        const selectedAddOnIds = Array.isArray(req.body.selectedAddOnIds)
            ? req.body.selectedAddOnIds
            : (Array.isArray(req.body.addOnIds) ? req.body.addOnIds : []);

        let selectedTier = null;
        let packageFee = Math.max(0, Number(event.ticketPrice) || 0);
        if (event.pricingMode === 'tiers' || (Array.isArray(event.tiers) && event.tiers.length > 0)) {
            const tiers = getSportsTiers({ ...event.toObject?.() || event, pricingMode: 'tiers' });
            if (!tierId) {
                // Free drive / spectator from join_drive answer when no package picked
                const join = String(cleanResponses.join_drive || '').toLowerCase();
                if (/spectator/i.test(join)) {
                    const spectator = tiers.find((t) => /tier_spectator/i.test(t.id) || /\bspectator/i.test(t.name));
                    if (spectator) tierId = spectator.id;
                } else if (/drive only/i.test(join) || (/^yes/i.test(join) && /free/i.test(join))) {
                    const drive = tiers.find((t) => /tier_drive_only/i.test(t.id) || /drive only/i.test(t.name));
                    if (drive) tierId = drive.id;
                }
            }
            if (!tierId) {
                return res.status(400).json({
                    success: false,
                    message: 'Select a package (or Drive only / Spectators).',
                });
            }
            try {
                const priced = resolveSportsPerPersonFee(
                    { ...event.toObject?.() || event, pricingMode: 'tiers', registrationFee: event.ticketPrice },
                    tierId,
                );
                selectedTier = priced.tier;
                packageFee = Math.max(0, Number(priced.fee) || 0);
            } catch (tierErr) {
                return res.status(400).json({
                    success: false,
                    message: tierErr.message || 'Invalid package',
                });
            }
        }

        let addOns = { selected: [], total: 0 };
        try {
            addOns = resolveEventAddOns(event, selectedAddOnIds);
        } catch (addOnErr) {
            return res.status(400).json({
                success: false,
                message: addOnErr.message || 'Invalid add-on selection',
            });
        }

        // Spectators don't get race-car add-ons
        if (isSpectatorTier({ tierId, tierName: selectedTier?.name })) {
            addOns = { selected: [], total: 0 };
        }

        const computedTotal = packageFee + addOns.total;
        const amountOverride = req.body.amountPaid;
        const amountPaid = amountOverride != null && amountOverride !== ''
            ? Math.max(0, Number(amountOverride) || 0)
            : computedTotal;

        let paymentStatus = String(req.body.paymentStatus || '').trim().toLowerCase();
        if (!['free', 'pending', 'paid', 'failed'].includes(paymentStatus)) {
            paymentStatus = amountPaid > 0 ? 'paid' : 'free';
        }
        if (amountPaid <= 0) paymentStatus = 'free';

        let status = String(req.body.status || 'approved').trim().toLowerCase();
        if (!['pending', 'approved', 'rejected'].includes(status)) status = 'approved';

        cleanResponses.name = name;
        if (email) cleanResponses.email = email;
        if (phone) cleanResponses.phone = phone;
        cleanResponses.manual_entry = 'yes';
        cleanResponses.added_by_organizer = 'yes';
        if (req.body.note) {
            cleanResponses.organizer_note = String(req.body.note).trim().slice(0, 500);
        }

        let user = null;
        if (email) {
            user = await User.findOne({ email });
        }
        if (!user && phone) {
            user = await User.findOne({ phoneNumber: phone });
        }
        if (!user) {
            user = new User({
                name,
                ...(email ? { email } : {}),
                ...(phone ? { phoneNumber: phone } : {}),
                password: crypto.randomBytes(24).toString('hex'),
                isVerified: true,
                signupMethod: 'password',
            });
            await user.save();
        }

        const now = new Date();
        const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const orClauses = [{ user: user._id }];
        if (email) {
            orClauses.push({ 'responses.email': new RegExp(`^${escapeRegex(email)}$`, 'i') });
        }
        const existing = await EventShowRegistration.findOne({
            eventShow: event._id,
            $or: orClauses,
        }).sort({ submittedAt: 1, createdAt: 1 });

        let registration;
        let addedToExisting = false;

        if (existing) {
            existing.additionalEntries = existing.additionalEntries || [];
            existing.additionalEntries.push({
                tierId: selectedTier?.id || tierId || null,
                tierName: selectedTier?.name || null,
                selectedAddOns: addOns.selected,
                amountPaid,
                paymentStatus,
                payment_gateway: 'manual_organizer',
                responses: { ...cleanResponses },
                status,
                submittedAt: now,
            });
            existing.reRegistrationCount = existing.additionalEntries.length;
            existing.amountPaid = Number(existing.amountPaid || 0) + amountPaid;
            if (status === 'approved' && existing.status !== 'approved') {
                existing.status = 'approved';
            }
            await existing.save();
            registration = existing;
            addedToExisting = true;
        } else {
            registration = new EventShowRegistration({
                eventShow: event._id,
                user: user._id,
                responses: cleanResponses,
                status,
                payment_gateway: 'manual_organizer',
                paymentStatus,
                amountPaid,
                tierId: selectedTier?.id || tierId || null,
                tierName: selectedTier?.name || null,
                selectedAddOns: addOns.selected,
                additionalEntries: [],
                reRegistrationCount: 0,
                submittedAt: now,
            });
            await registration.save();
        }

        const populated = await EventShowRegistration.findById(registration._id)
            .populate('user', 'name email phone phoneNumber')
            .lean();

        res.status(addedToExisting ? 200 : 201).json({
            success: true,
            message: addedToExisting
                ? 'Added package to existing guest'
                : 'Guest added manually',
            participant: formatParticipant(populated),
            addedToExisting,
        });
    } catch (error) {
        console.error('[eventShowOrganizer.createManualParticipant]', error);
        if (error?.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email or phone already exists — try matching details.',
            });
        }
        res.status(500).json({ success: false, message: error.message || 'Failed to add guest' });
    }
};

exports.exportParticipants = async (req, res) => {
    try {
        const format = String(req.query.format || 'xlsx').toLowerCase();
        const regs = await EventShowRegistration.find({ eventShow: req.eventShowId })
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        const responseKeySet = new Set();
        let maxDrivers = 1;
        const formatted = regs.map((reg) => {
            const p = formatParticipant(reg);
            Object.keys(p.responses || {}).forEach((k) => responseKeySet.add(k));
            maxDrivers = Math.max(maxDrivers, (p.drivers || []).length || 1);
            for (const entry of p.additionalEntries || []) {
                maxDrivers = Math.max(maxDrivers, (entry.drivers || []).length || 1);
            }
            return p;
        });
        // Prefer structured driver columns over raw driver_* response keys
        const responseKeys = Array.from(responseKeySet)
            .filter((k) => !/^driver_\d+_(name|email|phone|blood_group)$/i.test(k))
            .filter((k) => !/^section_driver_/i.test(k))
            .sort();

        const driverHeaders = [];
        for (let i = 1; i <= maxDrivers; i += 1) {
            driverHeaders.push(
                `driver_${i}_name`,
                `driver_${i}_phone`,
                `driver_${i}_email`,
                `driver_${i}_blood`,
            );
        }

        const header = [
            'id',
            'name',
            'email',
            'phone',
            'package',
            'all_packages',
            're_registration_count',
            'category',
            'join_drive',
            'blood_group',
            'vehicle_details',
            'driver_count',
            ...driverHeaders,
            'transaction_id',
            'payment_screenshot_url',
            'status',
            'paymentStatus',
            'amountPaid',
            'checkedIn',
            'checkedInAt',
            'submittedAt',
            ...responseKeys.map((k) => `response_${k}`),
        ];

        const body = formatted.map((p) => {
            const driversByIndex = new Map((p.drivers || []).map((d) => [Number(d.index) || 0, d]));
            const driverCells = [];
            for (let i = 1; i <= maxDrivers; i += 1) {
                const d = driversByIndex.get(i) || {};
                driverCells.push(d.name || '', d.phone || '', d.email || '', d.bloodGroup || '');
            }
            return [
                p.id,
                p.userName,
                p.userEmail,
                p.userPhone,
                p.tierName || '',
                (p.allTier || []).join(' | '),
                p.reRegistrationCount || 0,
                p.categoryLabel || '',
                p.joinDrive || '',
                p.bloodGroup || '',
                p.vehicleDetails || '',
                p.driverCount != null ? p.driverCount : '',
                ...driverCells,
                p.transactionId || '',
                p.paymentScreenshotUrl || '',
                p.status,
                p.paymentStatus,
                p.amountPaid,
                p.checkedIn ? 'yes' : 'no',
                p.checkedInAt || '',
                p.submittedAt || '',
                ...responseKeys.map((k) => {
                    const v = p.responses?.[k];
                    if (v == null) return '';
                    if (typeof v === 'object') return JSON.stringify(v);
                    return String(v);
                }),
            ];
        });

        const event = await EventShow.findById(req.eventShowId).select('title displayName').lean();
        const slug = String(event?.displayName || event?.title || 'event')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 40);

        if (format === 'csv') {
            const lines = [
                header.join(','),
                ...body.map((row) => row.map(csvEscape).join(',')),
            ];
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${slug}-registrations.csv"`);
            return res.send(`\uFEFF${lines.join('\n')}`);
        }

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'CrwdCtrl';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet('Guests', {
            views: [{ state: 'frozen', ySplit: 1 }],
        });
        sheet.addRow(header);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle', wrapText: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8F8FC' },
        };
        body.forEach((row) => sheet.addRow(row));
        header.forEach((_, colIdx) => {
            const column = sheet.getColumn(colIdx + 1);
            let max = String(header[colIdx] || '').length;
            body.forEach((row) => {
                const len = String(row[colIdx] ?? '').length;
                if (len > max) max = len;
            });
            column.width = Math.min(42, Math.max(12, max + 2));
        });

        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${slug}-registrations.xlsx"`);
        return res.send(buffer);
    } catch (error) {
        console.error('[eventShowOrganizer.exportParticipants]', error);
        res.status(500).json({ success: false, message: 'Failed to export' });
    }
};

exports.checkin = async (req, res) => {
    try {
        let raw = req.body.qrData || req.body.payload || req.body.hash || req.body.registrationId;
        if (!raw) {
            return res.status(400).json({ success: false, message: 'QR data or registration ID required' });
        }
        if (mongoose.Types.ObjectId.isValid(String(raw)) && String(raw).length === 24) {
            raw = JSON.stringify({ registrationId: String(raw), type: 'event' });
        }

        const result = await performCheckinFromRaw(raw, {
            eventShowId: req.eventShowId,
            allowTrek: false,
            allowSports: false,
            scannedBy: `event_organizer:${req.organizer.username || req.organizer.name}`,
            logToSheets: false,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('[eventShowOrganizer.checkin]', error);
        res.status(500).json({ success: false, message: 'Check-in failed' });
    }
};

exports.getCheckinStats = async (req, res) => {
    try {
        const event = await EventShow.findById(req.eventShowId).select('title displayName').lean();
        const [totalRegistered, totalCheckedIn] = await Promise.all([
            EventShowRegistration.countDocuments({ eventShow: req.eventShowId, status: 'approved' }),
            EventShowRegistration.countDocuments({
                eventShow: req.eventShowId,
                status: 'approved',
                checkedIn: true,
            }),
        ]);
        res.json({
            success: true,
            eventShowId: req.eventShowId,
            eventTitle: event?.displayName || event?.title || '',
            totalRegistered,
            totalCheckedIn,
            checkinRate: totalRegistered > 0
                ? Math.round((totalCheckedIn / totalRegistered) * 100)
                : 0,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load check-in stats' });
    }
};

async function notifyEventRegistrants({
    eventShowId,
    eventTitle,
    title,
    message,
    type = 'reminder',
    statusFilter = ['approved'],
}) {
    const regs = await EventShowRegistration.find({
        eventShow: eventShowId,
        status: { $in: statusFilter },
    })
        .populate('user', '_id')
        .select('user')
        .lean();

    const userIds = [...new Set(
        regs
            .map((r) => r.user?._id || r.user)
            .filter(Boolean)
            .map(String),
    )];

    let sent = 0;
    for (const userId of userIds) {
        try {
            await createNotification({
                userId,
                title,
                message,
                type: type === 'broadcast' ? 'announcement' : 'event',
                metadata: { eventShowId, eventTitle },
                link: `/events/${eventShowId}`,
            });
            sent += 1;
        } catch (err) {
            console.warn('[eventShowOrganizer.notify]', err.message);
        }
    }
    return { targeted: userIds.length, sent };
}

exports.sendReminder = async (req, res) => {
    try {
        const event = await EventShow.findById(req.eventShowId).select('title displayName').lean();
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        const eventTitle = event.displayName || event.title;
        const title = String(req.body.title || `Reminder: ${eventTitle}`).trim();
        const message = String(
            req.body.message || 'Your event is coming up soon. Bring your QR ticket.',
        ).trim();
        const stats = await notifyEventRegistrants({
            eventShowId: req.eventShowId,
            eventTitle,
            title,
            message,
            type: 'reminder',
        });
        res.json({ success: true, message: `Reminder sent to ${stats.sent} guests`, ...stats });
    } catch (error) {
        console.error('[eventShowOrganizer.sendReminder]', error);
        res.status(500).json({ success: false, message: 'Failed to send reminder' });
    }
};

exports.broadcastAnnouncement = async (req, res) => {
    try {
        const event = await EventShow.findById(req.eventShowId).select('title displayName').lean();
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        const eventTitle = event.displayName || event.title;
        const title = String(req.body.title || eventTitle).trim();
        const message = String(req.body.message || '').trim();
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }
        const stats = await notifyEventRegistrants({
            eventShowId: req.eventShowId,
            eventTitle,
            title,
            message,
            type: 'broadcast',
            statusFilter: ['approved', 'pending'],
        });
        res.json({ success: true, message: `Announcement sent to ${stats.sent} guests`, ...stats });
    } catch (error) {
        console.error('[eventShowOrganizer.broadcastAnnouncement]', error);
        res.status(500).json({ success: false, message: 'Failed to send announcement' });
    }
};
