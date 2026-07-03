const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const RunClubOrganizerAccount = require('../model/run_club_organizer_account_model');
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

const TOKEN_TTL = '7d';

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function getEventCapacity(event) {
    return Math.max(0, Number(event?.maxParticipants) || 0);
}

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
            { organizerId: organizer._id, role: 'run_club_organizer', username: organizer.username },
            getJwtSecret(),
            { expiresIn: TOKEN_TTL },
        );

        const [events, runClub] = await Promise.all([
            getOrganizerEvents(organizer),
            getOrganizerRunClub(organizer),
        ]);

        res.json({
            success: true,
            token,
            organizer: {
                id: organizer._id,
                name: organizer.name,
                username: organizer.username,
                phone: organizer.phone,
                runClubId: organizer.runClubId,
            },
            runClub,
            events,
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
            events,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const eventId = req.eventId;
        const event = await SportsEvent.findById(eventId)
            .select('title city eventDate status maxParticipants registration.status registrationFee distance reportingTime')
            .lean();
        if (!event) return res.status(404).json({ success: false, message: 'Run not found' });

        const today = startOfToday();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const baseFilter = { category: 'sports', eventId, status: 'confirmed' };

        const [totalRegistrations, checkedIn, paidRegs, todayRegistrations] = await Promise.all([
            CategoryRegistration.countDocuments(baseFilter),
            CategoryRegistration.countDocuments({ ...baseFilter, checkedIn: true }),
            CategoryRegistration.find(baseFilter).select('amountPaid').lean(),
            CategoryRegistration.countDocuments({ ...baseFilter, createdAt: { $gte: today, $lt: tomorrow } }),
        ]);

        const organizerRevenue = paidRegs.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
        const capacity = getEventCapacity(event);
        const seatsRemaining = capacity > 0 ? Math.max(0, capacity - totalRegistrations) : null;

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
            },
            stats: {
                totalRegistrations,
                seatsFilled: totalRegistrations,
                seatsRemaining,
                checkedIn,
                pendingCheckIn: Math.max(0, totalRegistrations - checkedIn),
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
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const skip = (page - 1) * limit;
        const search = String(req.query.search || '').trim();
        const paymentStatus = req.query.paymentStatus;
        const checkInStatus = req.query.checkInStatus;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

        const filter = { category: 'sports', eventId, status: 'confirmed' };

        if (paymentStatus === 'paid') filter.amountPaid = { $gt: 0 };
        if (paymentStatus === 'free') filter.amountPaid = { $lte: 0 };
        if (checkInStatus === 'checked_in') filter.checkedIn = true;
        if (checkInStatus === 'pending') filter.checkedIn = { $ne: true };

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            if (mongoose.Types.ObjectId.isValid(search)) {
                filter.$or = [{ _id: search }];
            } else {
                filter.$or = [
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
            SportsEvent.findById(eventId).select('title registration.formSchema registrationFee').lean(),
        ]);

        const formSchema = event?.registration?.formSchema || [];

        res.json({
            success: true,
            eventTitle: event?.title || '',
            trekName: event?.title || '',
            columns: buildSheetColumns(formSchema),
            participants: registrations.map((r) => formatParticipantSheetRow(r, event)),
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
            .select('title city registration.formSchema registrationFee eventDate reportingTime')
            .lean();
        res.json({ success: true, participant: formatParticipantDetail(registration, event) });
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

        if (mongoose.Types.ObjectId.isValid(q)) {
            filter.$or = [{ _id: q }];
        } else {
            filter.$or = [
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
            .select('title city registration.formSchema registrationFee')
            .lean();

        res.json({
            success: true,
            participants: registrations.map((r) => formatParticipantDetail(r, event)),
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
            status: 'confirmed',
        })
            .populate('user', 'name email phoneNumber')
            .sort({ createdAt: -1 })
            .lean();

        const event = await SportsEvent.findById(req.eventId)
            .select('title registration.formSchema')
            .lean();
        const rows = registrations.map((r) => formatParticipantDetail(r, event));
        const csv = participantsToCsv(rows, { formSchema: event?.registration?.formSchema || [] });
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

        const event = await SportsEvent.findById(req.eventId).select('title').lean();
        const eventTitle = event?.title || 'your run';
        const link = `/registration-details/${bookingId}?type=sports`;
        const title = 'Run Registration Confirmed';
        const message = `Your registration for ${eventTitle} is confirmed. View your ticket anytime.`;

        const result = await notifyRunClubParticipant({
            registration,
            eventId: req.eventId,
            eventTitle,
            title,
            message,
            type: 'registration',
            link,
            emailSubject: `Run registration confirmed — ${eventTitle}`,
            metadata: { registrationId: bookingId, resentBy: 'run_club_organizer' },
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
