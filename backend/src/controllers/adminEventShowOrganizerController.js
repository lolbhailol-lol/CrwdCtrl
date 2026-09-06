const mongoose = require('mongoose');
const EventShowOrganizerAccount = require('../model/event_show_organizer_account_model');
const EventShow = require('../model/event_show_model');
const EventShowManagerProfileInvite = require('../model/event_show_manager_profile_invite_model');
const { normalizeUsername } = require('../utils/normalizeUsername');
const { sendEventOrganizerApprovalEmail } = require('../services/emailService');

function serializeOrganizer(org) {
    const plain = typeof org.toObject === 'function' ? org.toObject() : { ...org };
    const status = EventShowOrganizerAccount.effectiveStatus(plain);
    return {
        ...plain,
        status,
        passwordHash: undefined,
    };
}

function parseAssignedIds(raw) {
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return list
        .map((id) => String(id || '').trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
}

function normalizeInviteEmail(email) {
    return String(email || '').trim().toLowerCase();
}

exports.listOrganizers = async (req, res) => {
    try {
        const filter = {};
        const statusQ = String(req.query.status || '').toLowerCase();
        if (['pending', 'approved', 'rejected'].includes(statusQ)) {
            filter.status = statusQ;
        }

        const organizers = await EventShowOrganizerAccount.find(filter)
            .select('-passwordHash')
            .populate('assignedEventShowIds', 'title displayName status')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            organizers: organizers.map((o) => serializeOrganizer(o)),
            pendingCount: await EventShowOrganizerAccount.countDocuments({ status: 'pending' }),
        });
    } catch (error) {
        console.error('[adminEventShowOrganizer.list]', error);
        res.status(500).json({ success: false, message: 'Failed to list organizers' });
    }
};

exports.createOrganizer = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const assignedEventShowIds = parseAssignedIds(req.body.assignedEventShowIds);

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (username.length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        if (!assignedEventShowIds.length) {
            return res.status(400).json({ success: false, message: 'Assign at least one event' });
        }

        const events = await EventShow.find({ _id: { $in: assignedEventShowIds } }).select('_id').lean();
        if (events.length !== assignedEventShowIds.length) {
            return res.status(400).json({ success: false, message: 'One or more events not found' });
        }

        const existing = await EventShowOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }

        const now = new Date();
        const organizer = await EventShowOrganizerAccount.create({
            name,
            username,
            email,
            passwordHash: await EventShowOrganizerAccount.hashPassword(password),
            phone,
            assignedEventShowIds,
            status: 'approved',
            isActive: true,
            approvedAt: now,
            approvedBy: req.user?.userId || null,
            createdBy: req.user?.userId || null,
        });

        const populated = await EventShowOrganizerAccount.findById(organizer._id)
            .select('-passwordHash')
            .populate('assignedEventShowIds', 'title displayName status')
            .lean();
        let emailStatus = { attempted: false, sent: false, reason: '' };
        try {
            if (email) {
                const assigned = await EventShow.find({ _id: { $in: assignedEventShowIds } })
                    .select('title displayName')
                    .lean();
                const eventTitles = assigned.map((e) => e.displayName || e.title || '').filter(Boolean);
                const loginUrl = `${String(process.env.FRONTEND_URL || 'https://crwdctrl.in').replace(/\/$/, '')}/event-organizer/login`;
                const mailResult = await sendEventOrganizerApprovalEmail({
                    toEmail: email,
                    organizerName: name,
                    username,
                    temporaryPassword: password,
                    accountCreatedByAdmin: true,
                    loginUrl,
                    eventTitles,
                });
                emailStatus = {
                    attempted: true,
                    sent: Boolean(mailResult?.success !== false && !mailResult?.error),
                    reason: mailResult?.error || '',
                };
            } else {
                emailStatus = { attempted: false, sent: false, reason: 'Organizer email not provided' };
            }
        } catch (mailErr) {
            console.error('[adminEventShowOrganizer.create] account mail failed:', mailErr.message);
            emailStatus = { attempted: true, sent: false, reason: mailErr.message || 'Failed to send email' };
        }

        res.status(201).json({
            success: true,
            message: 'Event organizer created',
            organizer: serializeOrganizer(populated),
            emailStatus,
        });
    } catch (error) {
        console.error('[adminEventShowOrganizer.create]', error);
        res.status(500).json({ success: false, message: 'Failed to create organizer' });
    }
};

exports.updateOrganizer = async (req, res) => {
    try {
        const organizer = await EventShowOrganizerAccount.findById(req.params.id);
        if (!organizer) {
            return res.status(404).json({ success: false, message: 'Organizer not found' });
        }

        if (req.body.name !== undefined) organizer.name = String(req.body.name || '').trim();
        if (req.body.phone !== undefined) organizer.phone = String(req.body.phone || '').trim();
        if (req.body.email !== undefined) organizer.email = String(req.body.email || '').trim().toLowerCase();
        if (req.body.isActive !== undefined) organizer.isActive = Boolean(req.body.isActive);

        if (req.body.username !== undefined) {
            const username = normalizeUsername(req.body.username);
            if (username.length < 3) {
                return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
            }
            const clash = await EventShowOrganizerAccount.findOne({
                username,
                _id: { $ne: organizer._id },
            });
            if (clash) {
                return res.status(409).json({ success: false, message: 'Username already taken' });
            }
            organizer.username = username;
        }

        if (req.body.password) {
            const password = String(req.body.password);
            if (password.length < 8) {
                return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
            }
            organizer.passwordHash = await EventShowOrganizerAccount.hashPassword(password);
        }

        if (req.body.assignedEventShowIds !== undefined) {
            const assignedEventShowIds = parseAssignedIds(req.body.assignedEventShowIds);
            if (!assignedEventShowIds.length) {
                return res.status(400).json({ success: false, message: 'Assign at least one event' });
            }
            const events = await EventShow.find({ _id: { $in: assignedEventShowIds } }).select('_id').lean();
            if (events.length !== assignedEventShowIds.length) {
                return res.status(400).json({ success: false, message: 'One or more events not found' });
            }
            organizer.assignedEventShowIds = assignedEventShowIds;
        }

        await organizer.save();
        const populated = await EventShowOrganizerAccount.findById(organizer._id)
            .select('-passwordHash')
            .populate('assignedEventShowIds', 'title displayName status')
            .lean();

        res.json({
            success: true,
            message: 'Organizer updated',
            organizer: serializeOrganizer(populated),
        });
    } catch (error) {
        console.error('[adminEventShowOrganizer.update]', error);
        res.status(500).json({ success: false, message: 'Failed to update organizer' });
    }
};

exports.approveOrganizer = async (req, res) => {
    try {
        const organizer = await EventShowOrganizerAccount.findById(req.params.id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });
        organizer.status = 'approved';
        organizer.isActive = true;
        organizer.approvedAt = new Date();
        organizer.approvedBy = req.user?.userId || null;
        organizer.rejectedReason = '';
        await organizer.save();
        let emailStatus = { attempted: false, sent: false, reason: '' };
        try {
            if (organizer.email) {
                const assigned = await EventShow.find({ _id: { $in: organizer.assignedEventShowIds || [] } })
                    .select('title displayName')
                    .lean();
                const eventTitles = assigned.map((e) => e.displayName || e.title || '').filter(Boolean);
                const loginUrl = `${String(process.env.FRONTEND_URL || 'https://crwdctrl.in').replace(/\/$/, '')}/event-organizer/login`;
                const mailResult = await sendEventOrganizerApprovalEmail({
                    toEmail: organizer.email,
                    organizerName: organizer.name || '',
                    username: organizer.username || '',
                    loginUrl,
                    eventTitles,
                });
                emailStatus = {
                    attempted: true,
                    sent: Boolean(mailResult?.success !== false && !mailResult?.error),
                    reason: mailResult?.error || '',
                };
            } else {
                emailStatus = { attempted: false, sent: false, reason: 'Organizer email not provided' };
            }
        } catch (mailErr) {
            console.error('[adminEventShowOrganizer.approve] approval mail failed:', mailErr.message);
            emailStatus = { attempted: true, sent: false, reason: mailErr.message || 'Failed to send email' };
        }
        res.json({ success: true, message: 'Organizer approved', organizer: serializeOrganizer(organizer), emailStatus });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to approve' });
    }
};

exports.rejectOrganizer = async (req, res) => {
    try {
        const organizer = await EventShowOrganizerAccount.findById(req.params.id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });
        organizer.status = 'rejected';
        organizer.isActive = false;
        organizer.rejectedReason = String(req.body.reason || '').trim();
        await organizer.save();
        res.json({ success: true, message: 'Organizer rejected', organizer: serializeOrganizer(organizer) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to reject' });
    }
};

exports.deleteOrganizer = async (req, res) => {
    try {
        const deleted = await EventShowOrganizerAccount.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Organizer not found' });
        res.json({ success: true, message: 'Organizer deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete' });
    }
};

exports.listProfileInvites = async (req, res) => {
    try {
        const invites = await EventShowManagerProfileInvite.find()
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, invites });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to list profile invites' });
    }
};

exports.addProfileInvite = async (req, res) => {
    try {
        const email = normalizeInviteEmail(req.body.email);
        const note = String(req.body.note || '').trim();
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'Valid email is required' });
        }

        const existing = await EventShowManagerProfileInvite.findOne({ email });
        if (existing) {
            existing.isActive = true;
            if (note) existing.note = note;
            await existing.save();
            return res.json({
                success: true,
                message: 'Email re-activated for Event organizer profile access',
                invite: existing,
            });
        }

        const invite = await EventShowManagerProfileInvite.create({
            email,
            note,
            isActive: true,
            createdBy: req.user?.userId || null,
        });

        res.status(201).json({
            success: true,
            message: 'Email approved — user will see Event organizer in Profile',
            invite,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Email already added' });
        }
        console.error('[adminEventShowOrganizer.addProfileInvite]', error);
        res.status(500).json({ success: false, message: 'Failed to add email' });
    }
};

exports.removeProfileInvite = async (req, res) => {
    try {
        const { inviteId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(inviteId)) {
            return res.status(400).json({ success: false, message: 'Invalid invite ID' });
        }
        const invite = await EventShowManagerProfileInvite.findByIdAndDelete(inviteId);
        if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
        res.json({ success: true, message: 'Email removed from Event organizer profile access' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove email' });
    }
};
