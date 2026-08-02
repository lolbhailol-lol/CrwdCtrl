const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const FestOrganizerAccount = require('../model/fest_organizer_account_model');
const FestOrganizer = require('../model/fest_organizer_model');
const FestOrganizerProfileInvite = require('../model/fest_organizer_profile_invite_model');
const Registration = require('../model/registration_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { performCheckinFromRaw } = require('../services/checkinService');
const { notifyFestParticipants } = require('../utils/festParticipantOutreach');
const {
    normalizeUsername,
    getOrganizerFests,
} = require('../utils/festOrganizerAccess');
const FestOrganizerLoginLog = require('../model/fest_organizer_login_log_model');

const TOKEN_TTL = '7d';

function normalizeDisplayName(raw) {
    return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function serializeLoginLog(row, selfId, selfDisplayName) {
    const name = row.displayName || row.username || 'Organizer';
    const isYou = String(row.organizer) === String(selfId)
        && String(row.displayNameKey || '') === String(selfDisplayName || '').trim().toLowerCase();
    return {
        id: String(row._id),
        organizerId: String(row.organizer),
        name,
        username: row.username || '',
        firstLoginAt: row.firstLoginAt || row.createdAt || null,
        lastLoginAt: row.lastLoginAt || null,
        loginCount: Number(row.loginCount) || 1,
        isYou,
    };
}

async function listPortalLoggedInUsers(selfId, selfDisplayName = '') {
    const rows = await FestOrganizerLoginLog.find({})
        .sort({ lastLoginAt: -1, displayName: 1 })
        .limit(200)
        .lean();
    return rows.map((r) => serializeLoginLog(r, selfId, selfDisplayName));
}

/** Save the name typed on the login page */
async function recordLoginDisplayName({ organizer, displayName }) {
    const name = normalizeDisplayName(displayName);
    if (!name || !organizer?._id) return null;
    const key = name.toLowerCase();
    const now = new Date();
    return FestOrganizerLoginLog.findOneAndUpdate(
        { organizer: organizer._id, displayNameKey: key },
        {
            $set: {
                displayName: name,
                username: organizer.username || '',
                lastLoginAt: now,
            },
            $inc: { loginCount: 1 },
            $setOnInsert: {
                organizer: organizer._id,
                displayNameKey: key,
                firstLoginAt: now,
            },
        },
        { upsert: true, new: true },
    );
}

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

function formatParticipant(reg) {
    const responses = responsesToObject(reg.responses);
    const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
    return {
        id: reg._id,
        status: reg.status,
        paymentStatus: reg.paymentStatus || 'free',
        amountPaid: Number(reg.amountPaid) || 0,
        checkedIn: Boolean(reg.checkedIn),
        checkedInAt: reg.checkedInAt || null,
        competitionId: reg.competitionId?._id || reg.competitionId || null,
        competitionName: reg.competitionId?.competitionName || reg.competitionId?.name || '',
        userName: user?.name || responses.full_name || responses.name || '',
        userEmail: user?.email || responses.email || '',
        userPhone: user?.phone || user?.phoneNumber || responses.contact_no || responses.phone || '',
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

async function buildOrganizerAuthResponse(organizer, { displayName } = {}) {
    organizer.lastLoginAt = new Date();
    if (!organizer.status) organizer.status = 'approved';
    await organizer.save();

    const typedName = normalizeDisplayName(displayName) || organizer.name || organizer.username || '';

    const token = jwt.sign(
        {
            organizerId: organizer._id,
            role: 'fest_organizer',
            username: organizer.username,
            displayName: typedName,
        },
        getJwtSecret(),
        { expiresIn: TOKEN_TTL },
    );

    const fests = await getOrganizerFests(organizer);

    try {
        await recordLoginDisplayName({ organizer, displayName: typedName });
    } catch (err) {
        console.warn('[festOrganizerPortal.login] login log', err.message);
    }

    let loggedInUsers = [];
    try {
        loggedInUsers = await listPortalLoggedInUsers(organizer._id, typedName);
    } catch (err) {
        console.warn('[festOrganizerPortal.login] list logins', err.message);
    }

    return {
        success: true,
        token,
        organizer: {
            id: organizer._id,
            name: typedName,
            accountName: organizer.name || '',
            username: organizer.username,
            email: organizer.email || '',
            phone: organizer.phone,
            status: FestOrganizerAccount.effectiveStatus(organizer),
            assignedFestIds: organizer.assignedFestIds || [],
            displayName: typedName,
        },
        fests,
        loggedInCount: loggedInUsers.length,
        loggedInUsers,
    };
}

exports.login = async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username || req.body.email);
        const password = String(req.body.password || '');
        const displayName = normalizeDisplayName(req.body.displayName || req.body.name);

        if (!displayName || displayName.length < 2) {
            return res.status(400).json({ success: false, message: 'Enter your name to sign in' });
        }
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const organizer = await FestOrganizerAccount.findOne({
            $or: [{ username }, { email: username }],
        });
        if (!organizer) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await organizer.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const status = FestOrganizerAccount.effectiveStatus(organizer);
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

        res.json(await buildOrganizerAuthResponse(organizer, { displayName }));
    } catch (error) {
        console.error('[festOrganizerPortal.login]', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

exports.signup = async (req, res) => {
    try {
        await FestOrganizerAccount.ensureSparseEmailIndex();

        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required — use the email CrwdCtrl approved for fest organizer access',
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

        const invite = await FestOrganizerProfileInvite.findOne({ email, isActive: true }).select('_id').lean();
        if (!invite) {
            return res.status(403).json({
                success: false,
                code: 'invite_required',
                message:
                    'This email is not approved for fest organizer signup. Ask CrwdCtrl to add your email under Admin → Fest Organizers → Profile emails first.',
            });
        }

        const existing = await FestOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }

        const emailTaken = await FestOrganizerAccount.findOne({ email });
        if (emailTaken) {
            return res.status(409).json({
                success: false,
                message: 'An organizer account already exists for this email. Sign in or wait for approval.',
            });
        }

        const organizer = await FestOrganizerAccount.create({
            name,
            username,
            email,
            passwordHash: await FestOrganizerAccount.hashPassword(password),
            phone,
            assignedFestIds: [],
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
            },
        });
    } catch (error) {
        console.error('[festOrganizerPortal.signup]', error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username or email already taken' });
        }
        res.status(500).json({ success: false, message: 'Failed to create account' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const fests = await getOrganizerFests(req.organizer);
        const displayName = normalizeDisplayName(req.displayName) || req.organizer.name || '';
        let loggedInUsers = [];
        try {
            loggedInUsers = await listPortalLoggedInUsers(req.organizerId, displayName);
        } catch (err) {
            console.warn('[festOrganizerPortal.getMe] login log', err.message);
        }
        res.json({
            success: true,
            organizer: {
                id: req.organizer._id,
                name: displayName || req.organizer.name,
                accountName: req.organizer.name || '',
                username: req.organizer.username,
                email: req.organizer.email || '',
                phone: req.organizer.phone,
                status: FestOrganizerAccount.effectiveStatus(req.organizer),
                displayName: displayName || req.organizer.name || '',
            },
            fests,
            loggedInCount: loggedInUsers.length,
            loggedInUsers,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const festId = req.festId;
        const festOid = new mongoose.Types.ObjectId(String(festId));
        const fest = await FestOrganizer.findById(festId)
            .select('festName collegeName city festDate festDates festType venue category status coverImage slug registration description subtitle ticketPrice feeAmount')
            .lean();
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });

        const Competition = mongoose.model('Competition');
        const today = startOfToday();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const baseApproved = { fest: festId, status: 'approved' };

        const [
            totalRegistrations,
            pendingRegistrations,
            rejectedRegistrations,
            checkedIn,
            paidRegs,
            todayRegistrations,
            allActiveCount,
            competitions,
            byCompetition,
            paymentBreakdown,
            recentRegs,
        ] = await Promise.all([
            Registration.countDocuments(baseApproved),
            Registration.countDocuments({ fest: festId, status: 'pending' }),
            Registration.countDocuments({ fest: festId, status: 'rejected' }),
            Registration.countDocuments({ ...baseApproved, checkedIn: true }),
            Registration.find(baseApproved).select('amountPaid paymentStatus').lean(),
            Registration.countDocuments({
                fest: festId,
                createdAt: { $gte: today, $lt: tomorrow },
            }),
            Registration.countDocuments({ fest: festId, status: { $in: ['pending', 'approved'] } }),
            Competition.find({ fest: festId })
                .select('name competitionType')
                .sort({ name: 1 })
                .lean(),
            Registration.aggregate([
                { $match: { fest: festOid } },
                {
                    $group: {
                        _id: '$competitionId',
                        total: { $sum: 1 },
                        approved: {
                            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
                        },
                        pending: {
                            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
                        },
                        rejected: {
                            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
                        },
                        checkedIn: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'approved'] },
                                            { $eq: ['$checkedIn', true] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        revenue: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'approved'] },
                                    { $ifNull: ['$amountPaid', 0] },
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),
            Registration.aggregate([
                { $match: { fest: festOid, status: { $in: ['pending', 'approved'] } } },
                {
                    $group: {
                        _id: { $ifNull: ['$paymentStatus', 'unknown'] },
                        count: { $sum: 1 },
                        amount: { $sum: { $ifNull: ['$amountPaid', 0] } },
                    },
                },
            ]),
            Registration.find({ fest: festId, status: { $in: ['pending', 'approved'] } })
                .populate('user', 'name email')
                .populate('competitionId', 'name')
                .sort({ createdAt: -1 })
                .limit(8)
                .select('status paymentStatus amountPaid checkedIn createdAt competitionId user responses')
                .lean(),
        ]);

        const revenue = paidRegs.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
        const statsById = new Map(
            byCompetition.map((row) => [row._id ? String(row._id) : 'none', row]),
        );

        const competitionStats = competitions.map((c) => {
            const row = statsById.get(String(c._id)) || {};
            const approved = Number(row.approved) || 0;
            const checked = Number(row.checkedIn) || 0;
            return {
                id: c._id,
                name: c.name || 'Competition',
                competitionType: c.competitionType || '',
                total: Number(row.total) || 0,
                approved,
                pending: Number(row.pending) || 0,
                rejected: Number(row.rejected) || 0,
                checkedIn: checked,
                pendingCheckIn: Math.max(0, approved - checked),
                checkInRate: approved > 0 ? Math.round((checked / approved) * 100) : 0,
                revenue: Number(row.revenue) || 0,
            };
        });

        const knownIds = new Set(competitions.map((c) => String(c._id)));
        let other = null;
        for (const [key, row] of statsById.entries()) {
            if (key !== 'none' && knownIds.has(key)) continue;
            const approved = Number(row.approved) || 0;
            const checked = Number(row.checkedIn) || 0;
            const chunk = {
                total: Number(row.total) || 0,
                approved,
                pending: Number(row.pending) || 0,
                rejected: Number(row.rejected) || 0,
                checkedIn: checked,
                revenue: Number(row.revenue) || 0,
            };
            if (!other) {
                other = { ...chunk };
            } else {
                other.total += chunk.total;
                other.approved += chunk.approved;
                other.pending += chunk.pending;
                other.rejected += chunk.rejected;
                other.checkedIn += chunk.checkedIn;
                other.revenue += chunk.revenue;
            }
        }
        if (other && other.total > 0) {
            other.pendingCheckIn = Math.max(0, other.approved - other.checkedIn);
            other.checkInRate = other.approved > 0
                ? Math.round((other.checkedIn / other.approved) * 100)
                : 0;
            competitionStats.push({
                id: null,
                name: 'Other / unassigned',
                competitionType: '',
                ...other,
            });
        }

        competitionStats.sort((a, b) => (b.total - a.total) || a.name.localeCompare(b.name));

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

        const recent = recentRegs.map((reg) => {
            const responses = responsesToObject(reg.responses);
            const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
            return {
                id: reg._id,
                status: reg.status,
                paymentStatus: reg.paymentStatus || 'free',
                amountPaid: Number(reg.amountPaid) || 0,
                checkedIn: Boolean(reg.checkedIn),
                competitionName: reg.competitionId?.name || '',
                userName: user?.name || responses.full_name || responses.name || '',
                userEmail: user?.email || responses.email || '',
                createdAt: reg.createdAt,
            };
        });

        res.json({
            success: true,
            fest: {
                id: fest._id,
                festName: fest.festName,
                subtitle: fest.subtitle || '',
                collegeName: fest.collegeName || '',
                city: fest.city || '',
                festDate: fest.festDate || '',
                festDates: fest.festDates || null,
                festType: fest.festType || '',
                venue: fest.venue || '',
                category: fest.category || '',
                status: fest.status || '',
                coverImage: fest.coverImage || '',
                slug: fest.slug || '',
                ticketPrice: fest.ticketPrice || '',
                feeAmount: Number(fest.feeAmount) || 0,
                description: fest.description || '',
                registrationMode: fest.registration?.mode || '',
                registrationStatus: fest.registration?.status || 'open',
            },
            stats: {
                totalRegistrations,
                pendingRegistrations,
                rejectedRegistrations,
                allActive: allActiveCount,
                checkedIn,
                pendingCheckIn: Math.max(0, totalRegistrations - checkedIn),
                checkInRate: totalRegistrations > 0
                    ? Math.round((checkedIn / totalRegistrations) * 100)
                    : 0,
                revenue,
                todayRegistrations,
                competitionCount: competitions.length,
                payments,
            },
            competitions: competitionStats,
            recent,
        });
    } catch (error) {
        console.error('[festOrganizerPortal.getDashboard]', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
};

/** People who typed their name and signed into the portal */
exports.listLoggedInUsers = async (req, res) => {
    try {
        const displayName = normalizeDisplayName(req.displayName) || req.organizer?.name || '';
        const loggedInUsers = await listPortalLoggedInUsers(req.organizerId, displayName);
        res.json({
            success: true,
            loggedInCount: loggedInUsers.length,
            loggedInUsers,
        });
    } catch (error) {
        console.error('[festOrganizerPortal.listLoggedInUsers]', error);
        res.status(500).json({ success: false, message: 'Failed to load logged-in users' });
    }
};

exports.listParticipants = async (req, res) => {
    try {
        const festId = req.festId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const skip = (page - 1) * limit;
        const search = String(req.query.search || '').trim();
        const status = String(req.query.status || '').trim();
        const checkInStatus = req.query.checkInStatus;
        const competitionId = req.query.competitionId;

        const filter = { fest: festId };

        if (['pending', 'approved', 'rejected'].includes(status)) {
            filter.status = status;
        } else {
            filter.status = { $in: ['pending', 'approved'] };
        }

        if (checkInStatus === 'checked_in') filter.checkedIn = true;
        if (checkInStatus === 'pending') filter.checkedIn = { $ne: true };
        if (competitionId && mongoose.Types.ObjectId.isValid(competitionId)) {
            filter.competitionId = competitionId;
        }

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const userIds = await mongoose.model('User').find({
                $or: [{ name: regex }, { email: regex }, { phone: regex }],
            }).select('_id').lean();
            const ids = userIds.map((u) => u._id);
            filter.$or = [
                { user: { $in: ids } },
                ...(mongoose.Types.ObjectId.isValid(search) ? [{ _id: search }] : []),
            ];
        }

        const Competition = mongoose.model('Competition');
        const [total, rows, competitions] = await Promise.all([
            Registration.countDocuments(filter),
            Registration.find(filter)
                .populate('user', 'name email phone phoneNumber')
                .populate('competitionId', 'competitionName name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Competition.find({ fest: festId }).select('name').sort({ name: 1 }).lean(),
        ]);

        res.json({
            success: true,
            participants: rows.map(formatParticipant),
            competitions: competitions.map((c) => ({ id: c._id, name: c.name || 'Competition' })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('[festOrganizerPortal.listParticipants]', error);
        res.status(500).json({ success: false, message: 'Failed to load participants' });
    }
};

exports.getParticipant = async (req, res) => {
    try {
        const { registrationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ success: false, message: 'Invalid registration ID' });
        }
        const reg = await Registration.findOne({ _id: registrationId, fest: req.festId })
            .populate('user', 'name email phone phoneNumber')
            .populate('competitionId', 'competitionName name')
            .lean();
        if (!reg) return res.status(404).json({ success: false, message: 'Participant not found' });
        res.json({ success: true, participant: formatParticipant(reg) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load participant' });
    }
};

exports.exportParticipants = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        const filter = {
            fest: req.festId,
            status: { $in: ['pending', 'approved'] },
        };
        const competitionId = String(req.query.competitionId || '').trim();
        if (competitionId && mongoose.Types.ObjectId.isValid(competitionId)) {
            filter.competitionId = competitionId;
        }
        const rows = await Registration.find(filter)
            .populate('user', 'name email phone phoneNumber')
            .populate('competitionId', 'competitionName name')
            .sort({ createdAt: -1 })
            .lean();

        const header = ['id', 'name', 'email', 'phone', 'status', 'paymentStatus', 'amountPaid', 'checkedIn', 'competition', 'submittedAt'];
        const lines = [header.join(',')];
        for (const reg of rows) {
            const p = formatParticipant(reg);
            lines.push([
                p.id,
                JSON.stringify(p.userName || ''),
                JSON.stringify(p.userEmail || ''),
                JSON.stringify(p.userPhone || ''),
                p.status,
                p.paymentStatus,
                p.amountPaid,
                p.checkedIn ? 'yes' : 'no',
                JSON.stringify(p.competitionName || ''),
                p.submittedAt ? new Date(p.submittedAt).toISOString() : '',
            ].join(','));
        }

        const safeName = (fest?.festName || 'fest').replace(/[^a-z0-9-_]+/gi, '_');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_participants.csv"`);
        res.send(lines.join('\n'));
    } catch (error) {
        console.error('[festOrganizerPortal.exportParticipants]', error);
        res.status(500).json({ success: false, message: 'Export failed' });
    }
};

exports.deleteParticipant = async (req, res) => {
    try {
        const { registrationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ success: false, message: 'Invalid registration ID' });
        }
        const reg = await Registration.findOne({ _id: registrationId, fest: req.festId });
        if (!reg) return res.status(404).json({ success: false, message: 'Participant not found' });
        reg.status = 'rejected';
        await reg.save();
        res.json({ success: true, message: 'Registration rejected' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update registration' });
    }
};

exports.updateParticipantStatus = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const status = String(req.body.status || '').trim().toLowerCase();
        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ success: false, message: 'Invalid registration ID' });
        }
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be pending, approved, or rejected' });
        }

        const reg = await Registration.findOne({ _id: registrationId, fest: req.festId });
        if (!reg) return res.status(404).json({ success: false, message: 'Participant not found' });

        reg.status = status;
        await reg.save();

        const populated = await Registration.findById(reg._id)
            .populate('user', 'name email phone phoneNumber')
            .populate('competitionId', 'competitionName name')
            .lean();

        res.json({
            success: true,
            message: status === 'approved'
                ? 'Registration approved'
                : status === 'rejected'
                    ? 'Registration rejected'
                    : 'Registration set to pending',
            participant: formatParticipant(populated),
        });
    } catch (error) {
        console.error('[festOrganizerPortal.updateParticipantStatus]', error);
        res.status(500).json({ success: false, message: 'Failed to update registration' });
    }
};

exports.checkin = async (req, res) => {
    try {
        let raw = req.body.qrData || req.body.payload || req.body.hash || req.body.registrationId;
        if (!raw) {
            return res.status(400).json({ success: false, message: 'QR data or registration ID required' });
        }
        if (mongoose.Types.ObjectId.isValid(String(raw)) && String(raw).length === 24) {
            raw = JSON.stringify({ registrationId: String(raw), type: 'fest' });
        }

        const result = await performCheckinFromRaw(raw, {
            festId: req.festId,
            allowTrek: false,
            allowSports: false,
            scannedBy: `fest_organizer:${req.organizer.username || req.organizer.name}`,
            logToSheets: false,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('[festOrganizerPortal.checkin]', error);
        res.status(500).json({ success: false, message: 'Check-in failed' });
    }
};

exports.getCheckinStats = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        const [totalRegistered, totalCheckedIn] = await Promise.all([
            Registration.countDocuments({ fest: req.festId, status: 'approved' }),
            Registration.countDocuments({ fest: req.festId, status: 'approved', checkedIn: true }),
        ]);
        res.json({
            success: true,
            festId: req.festId,
            festName: fest?.festName || '',
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

exports.sendReminder = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });

        const title = String(req.body.title || `Reminder: ${fest.festName}`).trim();
        const message = String(
            req.body.message || 'Your fest is coming up soon. Please arrive on time with your QR ticket.',
        ).trim();
        const competitionId = mongoose.Types.ObjectId.isValid(String(req.body.competitionId || ''))
            ? String(req.body.competitionId)
            : null;

        const stats = await notifyFestParticipants({
            festId: req.festId,
            festName: fest.festName,
            title,
            message,
            type: 'reminder',
            link: `/view-details/${req.festId}`,
            statusFilter: ['approved'],
            competitionId,
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

        const competitionId = mongoose.Types.ObjectId.isValid(String(req.body.competitionId || ''))
            ? String(req.body.competitionId)
            : null;

        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        const stats = await notifyFestParticipants({
            festId: req.festId,
            festName: fest?.festName || 'Fest',
            title,
            message,
            type: 'announcement',
            link: `/view-details/${req.festId}`,
            statusFilter: ['approved'],
            competitionId,
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
