const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const TrekOrganizerAccount = require('../model/trek_organizer_account_model');
const Trek = require('../model/trek_model');
const TrekBooking = require('../model/trek_booking_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { performCheckinFromRaw } = require('../services/checkinService');
const {
    notifyTrekParticipant,
    notifyTrekParticipants,
    resolveParticipantEmail,
    resolveParticipantName,
} = require('../utils/trekParticipantOutreach');
const { sendTrekRegistrationEmails, sendTrekParticipantEmails } = require('../services/emailService');
const { resolveTrekGroupLink } = require('../utils/resolveTrekGroupLink');
const {
    formatParticipantRow,
    formatParticipantDetail,
    formatParticipantSheetRow,
    buildSheetColumns,
    participantsToXlsx,
} = require('../utils/trekOrganizerFormat');
const {
    sanitizeGenderQuotas,
    sanitizeGenderPhase,
    getGenderRegistrationSnapshot,
    aggregateGenderQuotaStats,
} = require('../utils/trekGenderRegistration');
const {
    normalizeUsername,
    getOrganizerTreks,
    getOrganizerCommunity,
} = require('../utils/trekOrganizerAccess');
const TrekCommunity = require('../model/trek_community_model');
const TrekCommunityManagerProfileInvite = require('../model/trek_community_manager_profile_invite_model');

const { splitTrekOrganizerPayment } = require('../utils/platformFee');

const TOKEN_TTL = '7d';

async function buildOrganizerAuthResponse(organizer) {
    organizer.lastLoginAt = new Date();
    if (!organizer.status) organizer.status = 'approved';
    await organizer.save();

    const token = jwt.sign(
        { organizerId: organizer._id, role: 'trek_organizer', username: organizer.username },
        getJwtSecret(),
        { expiresIn: TOKEN_TTL },
    );

    const [treks, community] = await Promise.all([
        getOrganizerTreks(organizer),
        getOrganizerCommunity(organizer),
    ]);

    return {
        success: true,
        token,
        organizer: {
            id: organizer._id,
            name: organizer.name,
            username: organizer.username,
            email: organizer.email || '',
            phone: organizer.phone,
            communityId: organizer.communityId,
            status: TrekOrganizerAccount.effectiveStatus(organizer),
        },
        community,
        treks,
    };
}

async function sumOrganizerRevenue(bookings, trek) {
    let organizerRevenue = 0;
    let platformFees = 0;
    let grossCollected = 0;
    for (const booking of bookings) {
        const split = splitTrekOrganizerPayment(
            booking.bookingDetails?.amountPaid,
            trek?.platformFeePercent ?? 3,
            {
                registrationFeePerPerson: trek?.registrationFee ?? 0,
                people: booking.bookingDetails?.people,
            },
        );
        organizerRevenue += split.organizerNet;
        platformFees += split.platformFee;
        grossCollected += split.grossCollected;
    }
    return { organizerRevenue, platformFees, grossCollected };
}

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

async function getTrekCapacity(trek) {
    const maxFromBatches = Array.isArray(trek.trekBatches)
        ? trek.trekBatches.reduce((sum, b) => sum + (Number(b.batchSize) || 0), 0)
        : 0;
    const maxPeople = Number(trek.maxParticipants) || 0;
    const capacity = maxFromBatches || maxPeople || 0;
    return capacity;
}

exports.login = async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username || req.body.email);
        const password = String(req.body.password || '');

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const organizer = await TrekOrganizerAccount.findOne({
            $or: [{ username }, { email: username }],
        });
        if (!organizer) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await organizer.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const status = TrekOrganizerAccount.effectiveStatus(organizer);
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

        const payload = await buildOrganizerAuthResponse(organizer);
        res.json(payload);
    } catch (error) {
        console.error('[trekOrganizer.login]', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

/** Published communities for signup dropdown */
exports.listSignupCommunities = async (req, res) => {
    try {
        const communities = await TrekCommunity.find({ status: 'published' })
            .select('name basedIn')
            .sort({ name: 1 })
            .limit(200)
            .lean();

        res.json({
            success: true,
            communities: communities.map((c) => ({
                id: c._id,
                name: c.name,
                basedIn: c.basedIn || '',
            })),
        });
    } catch (error) {
        console.error('[trekOrganizer.listSignupCommunities]', error);
        res.status(500).json({ success: false, message: 'Failed to load communities' });
    }
};

/**
 * Consumer Profile sidebar: only allowlisted emails see Trek community.
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

        let invite = await TrekCommunityManagerProfileInvite.findOne({
            email,
            isActive: true,
        }).select('_id').lean();

        if (!invite) {
            invite = await TrekCommunityManagerProfileInvite.findOne({
                email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                isActive: true,
            }).select('_id').lean();
        }

        if (invite) {
            return res.json({ success: true, eligible: true });
        }

        const organizers = await TrekOrganizerAccount.find({
            $or: [
                { email },
                { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            ],
        }).lean();
        const approved = organizers.some((org) => TrekOrganizerAccount.canLogin(org));
        res.json({ success: true, eligible: approved });
    } catch (error) {
        console.error('[trekOrganizer.profileEligible]', error);
        res.status(500).json({ success: false, eligible: false, message: 'Failed to check access' });
    }
};

/**
 * Signed-in CrwdCtrl user → trek organizer portal when emails match an approved account.
 */
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
                message: 'Add an email to your CrwdCtrl account to use Trek community',
            });
        }

        const organizers = await TrekOrganizerAccount.find({
            $or: [
                { email },
                { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            ],
        }).sort({ updatedAt: -1 });
        const organizer = organizers.find((org) => TrekOrganizerAccount.canLogin(org));
        if (!organizer) {
            return res.status(403).json({
                success: false,
                code: 'no_organizer_account',
                message: 'No approved trek community account for this email. Create one or sign in with your organizer username and password.',
            });
        }

        const payload = await buildOrganizerAuthResponse(organizer);
        res.json(payload);
    } catch (error) {
        console.error('[trekOrganizer.appSession]', error);
        res.status(500).json({ success: false, message: 'Failed to open trek community session' });
    }
};

exports.signup = async (req, res) => {
    try {
        await TrekOrganizerAccount.ensureSparseEmailIndex();

        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const communityId = req.body.communityId;

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required — use the same email CrwdCtrl approved for Trek community access',
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
        if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
            return res.status(400).json({ success: false, message: 'Select a valid trek community' });
        }

        const invite = await TrekCommunityManagerProfileInvite.findOne({
            email,
            isActive: true,
        }).select('_id').lean();
        if (!invite) {
            return res.status(403).json({
                success: false,
                code: 'invite_required',
                message:
                    'This email is not approved for trek community signup. Ask CrwdCtrl to add your email under Admin → Community Organizers → Profile emails first.',
            });
        }

        const community = await TrekCommunity.findById(communityId).select('_id name').lean();
        if (!community) {
            return res.status(400).json({ success: false, message: 'Trek community not found' });
        }

        const existing = await TrekOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }

        const emailTaken = await TrekOrganizerAccount.findOne({ email });
        if (emailTaken) {
            return res.status(409).json({
                success: false,
                message: 'An organizer account already exists for this email. Sign in or wait for approval.',
            });
        }

        const organizer = await TrekOrganizerAccount.create({
            name,
            username,
            email,
            passwordHash: await TrekOrganizerAccount.hashPassword(password),
            phone,
            communityId,
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
                communityId: organizer.communityId,
                communityName: community.name,
            },
        });
    } catch (error) {
        console.error('[trekOrganizer.signup]', error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username or email already taken' });
        }
        res.status(500).json({ success: false, message: 'Failed to create account' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const [treks, community] = await Promise.all([
            getOrganizerTreks(req.organizer),
            getOrganizerCommunity(req.organizer),
        ]);
        res.json({
            success: true,
            organizer: {
                id: req.organizer._id,
                name: req.organizer.name,
                username: req.organizer.username,
                phone: req.organizer.phone,
                communityId: req.organizer.communityId,
            },
            community,
            treks,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const trekId = req.trekId;
        const trek = await Trek.findById(trekId).select(
            'trekName city trekDate dateLabel status maxParticipants trekBatches registrationFee platformFeePercent registration'
        ).lean();
        if (!trek) return res.status(404).json({ success: false, message: 'Trek not found' });

        const today = startOfToday();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const baseFilter = { trekId, status: 'confirmed' };

        const [
            totalRegistrations,
            checkedIn,
            paidBookings,
            todayRegistrations,
            seatAgg,
            pendingReview,
        ] = await Promise.all([
            TrekBooking.countDocuments(baseFilter),
            TrekBooking.countDocuments({ ...baseFilter, checkedIn: true }),
            TrekBooking.find(baseFilter).select('bookingDetails.amountPaid bookingDetails.people').lean(),
            TrekBooking.countDocuments({ ...baseFilter, createdAt: { $gte: today, $lt: tomorrow } }),
            TrekBooking.aggregate([
                { $match: baseFilter },
                { $group: { _id: null, seats: { $sum: '$bookingDetails.people' } } },
            ]),
            TrekBooking.countDocuments({ trekId, status: 'pending', paymentStatus: 'pending' }),
        ]);

        const { organizerRevenue, platformFees, grossCollected } = await sumOrganizerRevenue(paidBookings, trek);

        const seatsFilled = seatAgg[0]?.seats || totalRegistrations;
        const capacity = await getTrekCapacity(trek);
        const seatsRemaining = capacity > 0 ? Math.max(0, capacity - seatsFilled) : null;
        const genderRegistration = await getGenderRegistrationSnapshot(trek);
        const genderStats = await aggregateGenderQuotaStats(trekId);

        res.json({
            success: true,
            trek: {
                id: trek._id,
                trekName: trek.trekName,
                city: trek.city,
                trekDate: trek.trekDate,
                dateLabel: trek.dateLabel || '',
                trekBatches: Array.isArray(trek.trekBatches) ? trek.trekBatches : [],
                status: trek.status,
                capacity,
                registrationFee: Number(trek.registrationFee) || 0,
                registrationStatus: trek.registration?.status || 'open',
                registrationMode: trek.registration?.mode || 'internal_form',
                paymentQR: trek.registration?.paymentQR || '',
                paymentQRMessage: trek.registration?.paymentQRMessage || '',
                paymentUpiId: trek.registration?.paymentUpiId || '',
                genderQuotas: trek.registration?.genderQuotas || {},
                genderPhase: trek.registration?.genderPhase || 'all',
            },
            genderRegistration,
            stats: {
                totalRegistrations,
                seatsFilled,
                seatsRemaining,
                checkedIn,
                pendingCheckIn: Math.max(0, totalRegistrations - checkedIn),
                pendingReview,
                checkInRate: totalRegistrations > 0
                    ? Math.round((checkedIn / totalRegistrations) * 100)
                    : 0,
                revenue: organizerRevenue,
                organizerRevenue,
                platformFees,
                grossCollected,
                todayRegistrations,
                // Seat fills (people sum) so multi-person bookings count correctly on Women/Men tiles
                femaleCount: genderStats.female?.filled || 0,
                maleCount: genderStats.male?.filled || 0,
                othersCount: genderStats.others?.filled || 0,
                femaleBookings: genderStats.female?.bookings || 0,
                maleBookings: genderStats.male?.bookings || 0,
                othersBookings: genderStats.others?.bookings || 0,
            },
        });
    } catch (error) {
        console.error('[trekOrganizer.getDashboard]', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
};

exports.listParticipants = async (req, res) => {
    try {
        const trekId = req.trekId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const skip = (page - 1) * limit;
        const search = String(req.query.search || '').trim();
        const paymentStatus = req.query.paymentStatus;
        const checkInStatus = req.query.checkInStatus;
        const genderFilter = req.query.gender;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

        const filter = { trekId };

        if (paymentStatus === 'pending_review') {
            filter.status = 'pending';
            filter.paymentStatus = 'pending';
        } else if (paymentStatus === 'rejected') {
            filter.status = 'cancelled';
            filter.paymentStatus = 'failed';
        } else if (paymentStatus === 'paid') {
            filter.status = 'confirmed';
            filter['bookingDetails.amountPaid'] = { $gt: 0 };
        } else if (paymentStatus === 'free') {
            filter.status = 'confirmed';
            filter['bookingDetails.amountPaid'] = { $lte: 0 };
        } else {
            // Default list: active participants (confirmed + awaiting review)
            filter.status = { $in: ['confirmed', 'pending'] };
        }

        if (checkInStatus === 'checked_in') filter.checkedIn = true;
        if (checkInStatus === 'pending') filter.checkedIn = { $ne: true };
        if (genderFilter === 'Female' || genderFilter === 'Male' || genderFilter === 'Others') {
            filter.participantGender = genderFilter;
        }

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const searchOr = mongoose.Types.ObjectId.isValid(search)
                ? [{ _id: search }, { userName: regex }, { userEmail: regex }]
                : [
                    { userName: regex },
                    { userEmail: regex },
                    { 'formData.full_name': regex },
                    { 'formData.name': regex },
                    { 'formData.contact_no': regex },
                    { 'formData.phone': regex },
                    { 'formData.mobile': regex },
                ];
            filter.$and = [...(filter.$and || []), { $or: searchOr }];
        }

        const sortable = {
            createdAt: 'createdAt',
            name: 'userName',
            payment: 'bookingDetails.amountPaid',
            checkIn: 'checkedInAt',
        };
        const sortKey = sortable[sortBy] || 'createdAt';

        const [bookings, total, trek] = await Promise.all([
            TrekBooking.find(filter)
                .populate('userId', 'name email phoneNumber gender')
                .sort({ [sortKey]: sortDir })
                .skip(skip)
                .limit(limit)
                .lean(),
            TrekBooking.countDocuments(filter),
            Trek.findById(trekId).select('trekName registration.formSchema registrationFee platformFeePercent').lean(),
        ]);

        const formSchema = trek?.registration?.formSchema || [];

        res.json({
            success: true,
            trekName: trek?.trekName || '',
            columns: buildSheetColumns(formSchema),
            participants: bookings.map((b) => formatParticipantSheetRow(b, trek)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('[trekOrganizer.listParticipants]', error);
        res.status(500).json({ success: false, message: 'Failed to load participants' });
    }
};

exports.getParticipant = async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }

        const booking = await TrekBooking.findOne({ _id: bookingId, trekId: req.trekId })
            .populate('userId', 'name email phoneNumber')
            .lean();
        if (!booking) return res.status(404).json({ success: false, message: 'Participant not found' });

        const trek = await Trek.findById(req.trekId).select('trekName city registration.formSchema registrationFee platformFeePercent').lean();
        res.json({ success: true, participant: formatParticipantDetail(booking, trek) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load participant' });
    }
};

exports.lookupParticipant = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q) return res.status(400).json({ success: false, message: 'Search query required' });

        const filter = { trekId: req.trekId, status: 'confirmed' };
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        if (mongoose.Types.ObjectId.isValid(q)) {
            filter.$or = [{ _id: q }];
        } else {
            filter.$or = [
                { userName: regex },
                { userEmail: regex },
                { 'formData.full_name': regex },
                { 'formData.name': regex },
                { 'formData.contact_no': regex },
                { 'formData.phone': regex },
                { qrCodeData: regex },
            ];
        }

        const bookings = await TrekBooking.find(filter)
            .populate('userId', 'name email phoneNumber')
            .limit(10)
            .lean();

        const trek = await Trek.findById(req.trekId).select('trekName city registration.formSchema registrationFee platformFeePercent').lean();

        res.json({
            success: true,
            participants: bookings.map((b) => formatParticipantDetail(b, trek)),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lookup failed' });
    }
};

exports.exportParticipants = async (req, res) => {
    try {
        const bookings = await TrekBooking.find({
            trekId: req.trekId,
            status: { $in: ['confirmed', 'pending'] },
        })
            .populate('userId', 'name email phoneNumber')
            .sort({ createdAt: -1 })
            .lean();

        const trek = await Trek.findById(req.trekId)
            .select('trekName registration.formSchema registration.mode registrationFee platformFeePercent')
            .lean();
        const rows = bookings.map((b) => formatParticipantDetail(b, trek));
        const isOrganizerQr = (trek?.registration?.mode || 'internal_form') === 'organizer_qr';
        const buffer = await participantsToXlsx(rows, {
            formSchema: trek?.registration?.formSchema || [],
            includePaymentProof: isOrganizerQr,
        });
        const safeName = (trek?.trekName || 'trek').replace(/[^a-z0-9-_]+/gi, '_');

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_participants.xlsx"`);
        res.send(buffer);
    } catch (error) {
        console.error('[trekOrganizer.exportParticipants]', error);
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
            raw = JSON.stringify({ bookingId: String(raw), type: 'trek' });
        }

        const result = await performCheckinFromRaw(raw, {
            trekId: req.trekId,
            allowTrek: true,
            allowSports: false,
            scannedBy: `organizer:${req.organizer.username || req.organizer.name}`,
            logToSheets: false,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('[trekOrganizer.checkin]', error);
        res.status(500).json({ success: false, message: 'Check-in failed' });
    }
};

exports.deleteParticipant = async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }

        const booking = await TrekBooking.findOne({
            _id: bookingId,
            trekId: req.trekId,
            status: 'confirmed',
        });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Participant not found' });
        }

        booking.status = 'cancelled';
        await booking.save();

        res.json({ success: true, message: 'Entry removed' });
    } catch (error) {
        console.error('[trekOrganizer.deleteParticipant]', error);
        res.status(500).json({ success: false, message: 'Failed to delete entry' });
    }
};

exports.resendConfirmation = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await TrekBooking.findOne({ _id: bookingId, trekId: req.trekId })
            .populate('userId', 'name email notificationPreferences')
            .populate({
                path: 'trekId',
                select: 'trekName groupLink communityId',
                populate: { path: 'communityId', select: 'name groupLink' },
            });
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const trekName = booking.trekId?.trekName || 'your trek';
        const { groupLink, communityName } = resolveTrekGroupLink(booking.trekId);
        const link = `/registration-details/${booking._id}?type=trek`;
        const title = 'Trek Booking Confirmed';
        const message = groupLink
            ? `Your registration for ${trekName} is confirmed. Join the WhatsApp group for trek updates.`
            : `Your registration for ${trekName} is confirmed. View your ticket anytime.`;

        const result = await notifyTrekParticipant({
            booking: booking.toObject ? booking.toObject() : booking,
            trekId: req.trekId,
            trekName,
            title,
            message,
            type: 'registration',
            link,
            emailSubject: `Trek booking confirmed — ${trekName}`,
            metadata: { registrationId: booking._id, resentBy: 'trek_organizer', groupLink: groupLink || undefined },
            skipEmail: true,
        });

        const userEmail = booking.userId?.email || booking.userEmail;
        const userName = booking.userId?.name || booking.userName;
        let emailSent = false;
        if (userEmail) {
            try {
                await sendTrekRegistrationEmails({
                    userEmail,
                    userName,
                    trekName,
                    bookingId: booking._id,
                    bookingDetails: {
                        date: booking.bookingDetails?.date || '',
                        time: booking.bookingDetails?.time || '',
                    },
                    amountPaid: booking.bookingDetails?.amountPaid || 0,
                    groupLink,
                    communityName,
                });
                emailSent = true;
            } catch (emailErr) {
                console.error('[Trek Organizer] Resend confirmation email failed:', emailErr.message);
            }
        }

        if (!result.inApp && !result.push && !emailSent) {
            return res.status(400).json({
                success: false,
                message: 'No email or linked account found for this participant',
            });
        }

        res.json({
            success: true,
            message: 'Confirmation resent',
            delivery: {
                inApp: result.inApp,
                push: result.push,
                email: emailSent,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to resend confirmation' });
    }
};

exports.sendParticipantMessages = async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const message = String(req.body.message || '').trim();
        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        const bookingIds = (Array.isArray(req.body.bookingIds) ? req.body.bookingIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (!bookingIds.length) {
            return res.status(400).json({ success: false, message: 'Select at least one participant' });
        }

        const includeWhatsAppLink = req.body.includeWhatsAppLink === true;
        const notifyInApp = req.body.notifyInApp !== false;

        const trek = await Trek.findById(req.trekId)
            .populate('communityId', 'name groupLink')
            .select('trekName groupLink communityId')
            .lean();
        if (!trek) return res.status(404).json({ success: false, message: 'Trek not found' });

        const resolved = resolveTrekGroupLink(trek);
        const groupLink = includeWhatsAppLink ? resolved.groupLink : '';
        const communityName = includeWhatsAppLink ? resolved.communityName : '';
        const trekName = trek.trekName || 'Trek';

        const bookings = await TrekBooking.find({
            _id: { $in: bookingIds },
            trekId: req.trekId,
            status: 'confirmed',
        }).populate('userId', 'name email notificationPreferences');

        const stats = {
            email: 0,
            emailFailed: 0,
            inApp: 0,
            push: 0,
            skipped: bookingIds.length - bookings.length,
            requested: bookingIds.length,
        };

        for (const booking of bookings) {
            const bookingObj = booking.toObject ? booking.toObject() : booking;
            const email = resolveParticipantEmail(bookingObj);
            const name = resolveParticipantName(bookingObj);
            const link = `/registration-details/${booking._id}?type=trek`;
            let delivered = false;

            if (email) {
                const result = await sendTrekParticipantEmails([{
                    email,
                    name,
                    subject: title,
                    title,
                    message,
                    trekName,
                    link,
                    kind: 'organizer',
                    groupLink,
                    communityName,
                }]);
                if (result.success > 0) {
                    stats.email += 1;
                    delivered = true;
                } else {
                    stats.emailFailed += 1;
                }
            }

            if (notifyInApp) {
                const notif = await notifyTrekParticipant({
                    booking: bookingObj,
                    trekId: req.trekId,
                    trekName,
                    title,
                    message,
                    type: 'announcement',
                    link,
                    emailSubject: title,
                    metadata: { source: 'trek_organizer_direct', bookingId: booking._id },
                    skipEmail: true,
                });
                if (notif.inApp) {
                    stats.inApp += 1;
                    delivered = true;
                }
                if (notif.push) stats.push += 1;
            }

            if (!delivered) stats.skipped += 1;
        }

        if (stats.email === 0 && stats.inApp === 0 && stats.push === 0) {
            return res.status(400).json({
                success: false,
                message: 'Could not deliver to any selected participant (missing email or app account)',
                delivery: stats,
            });
        }

        res.json({
            success: true,
            message: `Message sent to ${stats.email + stats.inApp} participant(s)`,
            delivery: stats,
        });
    } catch (error) {
        console.error('[trekOrganizer.sendParticipantMessages]', error);
        res.status(500).json({ success: false, message: 'Failed to send messages' });
    }
};

exports.sendReminder = async (req, res) => {
    try {
        const trek = await Trek.findById(req.trekId).select('trekName meetingLocation departureTime').lean();
        if (!trek) return res.status(404).json({ success: false, message: 'Trek not found' });

        const title = String(req.body.title || `Reminder: ${trek.trekName}`).trim();
        const message = String(req.body.message || 'Your trek is coming up soon. Please arrive on time with your QR ticket.').trim();

        const stats = await notifyTrekParticipants({
            trekId: req.trekId,
            trekName: trek.trekName,
            title,
            message,
            type: 'reminder',
            link: `/trek/${req.trekId}`,
            emailSubject: title,
            metadata: { source: 'trek_organizer' },
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

        const trek = await Trek.findById(req.trekId).select('trekName').lean();

        const stats = await notifyTrekParticipants({
            trekId: req.trekId,
            trekName: trek?.trekName || 'Trek',
            title,
            message,
            type: 'announcement',
            link: `/trek/${req.trekId}`,
            emailSubject: title,
            metadata: { source: 'trek_organizer_broadcast' },
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

exports.updateRegistrationSettings = async (req, res) => {
    try {
        const trek = await Trek.findById(req.trekId);
        if (!trek) {
            return res.status(404).json({ success: false, message: 'Trek not found' });
        }

        const body = req.body || {};
        if (!trek.registration) trek.registration = {};

        if (body.genderQuotas !== undefined) {
            trek.registration.genderQuotas = sanitizeGenderQuotas({
                ...(trek.registration.genderQuotas?.toObject?.() || trek.registration.genderQuotas || {}),
                ...body.genderQuotas,
            });
        }
        if (body.genderPhase !== undefined) {
            trek.registration.genderPhase = sanitizeGenderPhase(body.genderPhase);
        }
        if (body.registrationStatus !== undefined) {
            const allowed = ['open', 'closed', 'not_open_yet'];
            if (allowed.includes(body.registrationStatus)) {
                trek.registration.status = body.registrationStatus;
            }
        }
        if (body.mode !== undefined) {
            const allowedModes = ['internal_form', 'external_link', 'organizer_qr'];
            if (allowedModes.includes(body.mode)) {
                trek.registration.mode = body.mode;
            }
        }
        if (body.paymentQR !== undefined) {
            trek.registration.paymentQR = String(body.paymentQR || '').trim();
        }
        if (body.paymentQRMessage !== undefined) {
            trek.registration.paymentQRMessage = String(body.paymentQRMessage || '').trim();
        }
        if (body.paymentUpiId !== undefined) {
            trek.registration.paymentUpiId = String(body.paymentUpiId || '').trim();
        }

        const mode = trek.registration.mode || 'internal_form';
        const fee = Number(trek.registrationFee) || 0;
        if (mode === 'organizer_qr' && fee > 0 && !String(trek.registration.paymentQR || '').trim()) {
            return res.status(400).json({
                success: false,
                message: 'Upload a payment QR before enabling Form + UPI QR mode for a paid trek.',
            });
        }

        trek.markModified('registration');
        await trek.save();

        const genderRegistration = await getGenderRegistrationSnapshot(trek.toObject());

        res.json({
            success: true,
            message: 'Registration settings updated',
            trek: {
                id: trek._id,
                registrationStatus: trek.registration.status,
                registrationMode: trek.registration.mode,
                paymentQR: trek.registration.paymentQR || '',
                paymentQRMessage: trek.registration.paymentQRMessage || '',
                paymentUpiId: trek.registration.paymentUpiId || '',
                genderQuotas: trek.registration.genderQuotas,
                genderPhase: trek.registration.genderPhase,
            },
            genderRegistration,
        });
    } catch (error) {
        console.error('[trekOrganizer.updateRegistrationSettings]', error);
        res.status(500).json({ success: false, message: 'Failed to update registration settings' });
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
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }

        const booking = await TrekBooking.findOne({
            _id: bookingId,
            trekId: req.trekId,
        }).populate('userId', 'name email phoneNumber notificationPreferences');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }
        if (booking.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Registration is already ${booking.status}`,
            });
        }

        const trek = await Trek.findById(req.trekId)
            .select('trekName registrationFee platformFeePercent groupLink communityId')
            .populate('communityId', 'name groupLink')
            .lean();
        const trekName = trek?.trekName || 'your trek';
        const reviewer = req.organizer?.username || req.organizer?.name || 'organizer';
        const { groupLink, communityName } = resolveTrekGroupLink(trek);

        if (action === 'approve') {
            const due = Number(booking.bookingDetails?.amountPaid) || 0;
            const hasProof = Boolean(String(booking.paymentScreenshotUrl || '').trim());
            if (due > 0 && !hasProof) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot approve — no payment screenshot attached. Reject or ask the participant to re-register with proof.',
                });
            }
            booking.status = 'confirmed';
            booking.paymentStatus = due > 0 ? 'paid' : 'free';
            booking.paymentReviewNote = note || 'Approved by organizer';
        } else {
            booking.status = 'cancelled';
            booking.paymentStatus = 'failed';
            booking.paymentReviewNote = note;
        }

        booking.paymentReviewedAt = new Date();
        booking.paymentReviewedBy = String(reviewer);
        await booking.save();

        const leanBooking = booking.toObject ? booking.toObject() : booking;
        const link = `/registration-details/${booking._id}?type=trek`;

        if (action === 'approve') {
            notifyTrekParticipant({
                booking: leanBooking,
                trekId: req.trekId,
                trekName,
                title: 'Payment approved — you’re in!',
                message: `Great news! Your payment for ${trekName} was approved by the organizer. Download your ticket below.`,
                type: 'registration',
                link,
                emailSubject: `You’re confirmed — ${trekName}`,
                metadata: { registrationId: String(booking._id), action: 'approve' },
                skipEmail: true,
            }).catch((err) => console.error('[trekOrganizer.reviewPayment.notify.approve]', err));

            const userEmail = resolveParticipantEmail(leanBooking);
            const userName = resolveParticipantName(leanBooking);
            if (userEmail) {
                sendTrekRegistrationEmails({
                    userEmail,
                    userName,
                    trekName,
                    bookingId: booking._id,
                    bookingDetails: {
                        date: booking.bookingDetails?.date || '',
                        time: booking.bookingDetails?.time || '',
                    },
                    amountPaid: booking.bookingDetails?.amountPaid || 0,
                    groupLink,
                    communityName,
                }).catch((err) => console.error('[trekOrganizer.reviewPayment.email]', err.message));
            }
        } else {
            notifyTrekParticipant({
                booking: leanBooking,
                trekId: req.trekId,
                trekName,
                title: 'Payment not approved',
                message: `Your payment for ${trekName} was not approved. Reason: ${note}. You can register again with a valid screenshot.`,
                type: 'registration',
                link: '/booking',
                emailSubject: `Payment not approved — ${trekName}`,
                metadata: { registrationId: String(booking._id), action: 'reject', note },
            }).catch((err) => console.error('[trekOrganizer.reviewPayment.notify.reject]', err));
        }

        res.json({
            success: true,
            message: action === 'approve' ? 'Payment approved' : 'Registration rejected',
            participant: formatParticipantDetail(leanBooking, trek),
        });
    } catch (error) {
        console.error('[trekOrganizer.reviewPayment]', error);
        res.status(500).json({ success: false, message: 'Failed to review payment' });
    }
};

exports.getCheckinStats = async (req, res) => {
    try {
        const trek = await Trek.findById(req.trekId).select('trekName city').lean();
        const [totalRegistered, totalCheckedIn] = await Promise.all([
            TrekBooking.countDocuments({ trekId: req.trekId, status: 'confirmed' }),
            TrekBooking.countDocuments({ trekId: req.trekId, status: 'confirmed', checkedIn: true }),
        ]);

        res.json({
            success: true,
            trekId: req.trekId,
            trekName: trek?.trekName,
            city: trek?.city,
            totalRegistered,
            totalCheckedIn,
            checkinRate: totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load check-in stats' });
    }
};
