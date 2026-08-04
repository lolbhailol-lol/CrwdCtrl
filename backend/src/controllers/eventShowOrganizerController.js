const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const EventShowOrganizerAccount = require('../model/event_show_organizer_account_model');
const EventShow = require('../model/event_show_model');
const EventShowRegistration = require('../model/event_show_registration_model');
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

function formatParticipant(reg) {
    const responses = responsesToObject(reg.responses);
    const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
    return {
        id: String(reg._id),
        status: reg.status,
        paymentStatus: reg.paymentStatus || 'free',
        amountPaid: Number(reg.amountPaid) || 0,
        tierId: reg.tierId || null,
        tierName: reg.tierName || null,
        checkedIn: Boolean(reg.checkedIn),
        checkedInAt: reg.checkedInAt || null,
        userName: user?.name || responses.full_name || responses.name || '',
        userEmail: user?.email || responses.email || '',
        userPhone: user?.phone || user?.phoneNumber || responses.contact_no || responses.phone || responses.mobile || '',
        submittedAt: reg.submittedAt || reg.createdAt,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
        qrCodeData: reg.qrCodeData || null,
        payment_id: reg.payment_id || null,
        payment_order_id: reg.payment_order_id || null,
        payment_gateway: reg.payment_gateway || null,
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
            },
            tiers: tierBreakdown.map((row) => ({
                tierId: row._id?.tierId || null,
                tierName: row._id?.tierName || 'No package',
                count: Number(row.count) || 0,
                paid: Number(row.paid) || 0,
                revenue: Number(row.revenue) || 0,
            })),
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

        if (search) {
            const q = search.toLowerCase();
            regs = regs.filter((reg) => {
                const p = formatParticipant(reg);
                return [p.userName, p.userEmail, p.userPhone, p.tierName, String(p.id)]
                    .join(' ')
                    .toLowerCase()
                    .includes(q);
            });
        }

        const total = regs.length;
        const pageRows = regs.slice(skip, skip + limit).map(formatParticipant);

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
        reg.status = status;
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

exports.exportParticipants = async (req, res) => {
    try {
        const regs = await EventShowRegistration.find({ eventShow: req.eventShowId })
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        const headers = [
            'id', 'name', 'email', 'phone', 'status', 'paymentStatus', 'amountPaid',
            'tierName', 'checkedIn', 'checkedInAt', 'submittedAt',
        ];
        const lines = [headers.join(',')];
        for (const reg of regs) {
            const p = formatParticipant(reg);
            lines.push([
                p.id,
                p.userName,
                p.userEmail,
                p.userPhone,
                p.status,
                p.paymentStatus,
                p.amountPaid,
                p.tierName || '',
                p.checkedIn ? 'yes' : 'no',
                p.checkedInAt || '',
                p.submittedAt || '',
            ].map(csvEscape).join(','));
        }

        const event = await EventShow.findById(req.eventShowId).select('title displayName').lean();
        const slug = String(event?.displayName || event?.title || 'event')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 40);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${slug}-registrations.csv"`);
        res.send(lines.join('\n'));
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
