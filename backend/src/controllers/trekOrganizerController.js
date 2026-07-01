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
} = require('../utils/trekParticipantOutreach');
const {
    formatParticipantRow,
    formatParticipantDetail,
    formatParticipantSheetRow,
    buildSheetColumns,
    participantsToCsv,
} = require('../utils/trekOrganizerFormat');
const {
    normalizeUsername,
    getOrganizerTreks,
    getOrganizerCommunity,
} = require('../utils/trekOrganizerAccess');

const { splitTrekOrganizerPayment } = require('../utils/platformFee');

const TOKEN_TTL = '7d';

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
        if (!organizer || !organizer.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await organizer.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        organizer.lastLoginAt = new Date();
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

        res.json({
            success: true,
            token,
            organizer: {
                id: organizer._id,
                name: organizer.name,
                username: organizer.username,
                phone: organizer.phone,
                communityId: organizer.communityId,
            },
            community,
            treks,
        });
    } catch (error) {
        console.error('[trekOrganizer.login]', error);
        res.status(500).json({ success: false, message: 'Login failed' });
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
        const trek = await Trek.findById(trekId).select('trekName city trekDate status maxParticipants trekBatches registration.status registrationFee platformFeePercent').lean();
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
        ] = await Promise.all([
            TrekBooking.countDocuments(baseFilter),
            TrekBooking.countDocuments({ ...baseFilter, checkedIn: true }),
            TrekBooking.find(baseFilter).select('bookingDetails.amountPaid bookingDetails.people').lean(),
            TrekBooking.countDocuments({ ...baseFilter, createdAt: { $gte: today, $lt: tomorrow } }),
            TrekBooking.aggregate([
                { $match: baseFilter },
                { $group: { _id: null, seats: { $sum: '$bookingDetails.people' } } },
            ]),
        ]);

        const { organizerRevenue, platformFees, grossCollected } = await sumOrganizerRevenue(paidBookings, trek);

        const seatsFilled = seatAgg[0]?.seats || totalRegistrations;
        const capacity = await getTrekCapacity(trek);
        const seatsRemaining = capacity > 0 ? Math.max(0, capacity - seatsFilled) : null;

        res.json({
            success: true,
            trek: {
                id: trek._id,
                trekName: trek.trekName,
                city: trek.city,
                trekDate: trek.trekDate,
                status: trek.status,
                capacity,
            },
            stats: {
                totalRegistrations,
                seatsFilled,
                seatsRemaining,
                checkedIn,
                pendingCheckIn: Math.max(0, totalRegistrations - checkedIn),
                revenue: organizerRevenue,
                organizerRevenue,
                platformFees,
                grossCollected,
                todayRegistrations,
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
        const sortBy = req.query.sortBy || 'createdAt';
        const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

        const filter = { trekId, status: 'confirmed' };

        if (paymentStatus === 'paid') filter['bookingDetails.amountPaid'] = { $gt: 0 };
        if (paymentStatus === 'free') filter['bookingDetails.amountPaid'] = { $lte: 0 };
        if (checkInStatus === 'checked_in') filter.checkedIn = true;
        if (checkInStatus === 'pending') filter.checkedIn = { $ne: true };

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            if (mongoose.Types.ObjectId.isValid(search)) {
                filter.$or = [{ _id: search }, { userName: regex }, { userEmail: regex }];
            } else {
                filter.$or = [
                    { userName: regex },
                    { userEmail: regex },
                    { 'formData.full_name': regex },
                    { 'formData.name': regex },
                    { 'formData.contact_no': regex },
                    { 'formData.phone': regex },
                    { 'formData.mobile': regex },
                ];
            }
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
                .populate('userId', 'name email phoneNumber')
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
        const bookings = await TrekBooking.find({ trekId: req.trekId, status: 'confirmed' })
            .populate('userId', 'name email phoneNumber')
            .sort({ createdAt: -1 })
            .lean();

        const trek = await Trek.findById(req.trekId).select('trekName registration.formSchema registrationFee platformFeePercent').lean();
        const rows = bookings.map((b) => formatParticipantDetail(b, trek));
        const csv = participantsToCsv(rows, { formSchema: trek?.registration?.formSchema || [] });
        const safeName = (trek?.trekName || 'trek').replace(/[^a-z0-9-_]+/gi, '_');

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

exports.resendConfirmation = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await TrekBooking.findOne({ _id: bookingId, trekId: req.trekId })
            .populate('userId', 'name email notificationPreferences')
            .populate('trekId', 'trekName');
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const trekName = booking.trekId?.trekName || 'your trek';
        const link = `/registration-details/${booking._id}?type=trek`;
        const title = 'Trek Booking Confirmed';
        const message = `Your registration for ${trekName} is confirmed. View your ticket anytime.`;

        const result = await notifyTrekParticipant({
            booking: booking.toObject ? booking.toObject() : booking,
            trekId: req.trekId,
            trekName,
            title,
            message,
            type: 'registration',
            link,
            emailSubject: `Trek booking confirmed — ${trekName}`,
            metadata: { registrationId: booking._id, resentBy: 'trek_organizer' },
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
            delivery: {
                inApp: result.inApp,
                push: result.push,
                email: result.email,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to resend confirmation' });
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
