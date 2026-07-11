const mongoose = require('mongoose');
const RunClubOrganizerAccount = require('../model/run_club_organizer_account_model');
const RunClub = require('../model/run_club_model');
const { normalizeUsername } = require('../utils/runClubOrganizerAccess');

function serializeOrganizer(org) {
    const plain = typeof org.toObject === 'function' ? org.toObject() : { ...org };
    const status = RunClubOrganizerAccount.effectiveStatus(plain);
    return {
        ...plain,
        status,
        passwordHash: undefined,
    };
}

exports.listOrganizers = async (req, res) => {
    try {
        const filter = {};
        const statusQ = String(req.query.status || '').toLowerCase();
        if (['pending', 'approved', 'rejected'].includes(statusQ)) {
            if (statusQ === 'approved') {
                // Include legacy accounts with no status but isActive
                filter.$or = [
                    { status: 'approved' },
                    { status: { $exists: false }, isActive: { $ne: false } },
                    { status: null, isActive: { $ne: false } },
                ];
            } else if (statusQ === 'pending') {
                filter.status = 'pending';
            } else {
                filter.$or = [
                    { status: 'rejected' },
                    { status: { $exists: false }, isActive: false },
                ];
            }
        }

        const organizers = await RunClubOrganizerAccount.find(filter)
            .select('-passwordHash')
            .populate('runClubId', 'name basedIn')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            organizers: organizers.map((o) => serializeOrganizer(o)),
            pendingCount: await RunClubOrganizerAccount.countDocuments({ status: 'pending' }),
        });
    } catch (error) {
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
        const runClubId = req.body.runClubId;

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (username.length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters (letters, numbers, underscore)' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        if (!runClubId || !mongoose.Types.ObjectId.isValid(runClubId)) {
            return res.status(400).json({ success: false, message: 'A valid run club is required' });
        }

        const runClub = await RunClub.findById(runClubId).select('_id name').lean();
        if (!runClub) {
            return res.status(400).json({ success: false, message: 'Run club not found' });
        }

        const existing = await RunClubOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }

        const now = new Date();
        const organizer = await RunClubOrganizerAccount.create({
            name,
            username,
            email,
            passwordHash: await RunClubOrganizerAccount.hashPassword(password),
            phone,
            runClubId,
            status: 'approved',
            isActive: true,
            approvedAt: now,
            approvedBy: req.user?.userId || null,
            createdBy: req.user?.userId || null,
        });

        res.status(201).json({
            success: true,
            message: 'Run club organizer account created',
            organizer: serializeOrganizer(organizer),
        });
    } catch (error) {
        console.error('[adminRunClubOrganizer.create]', error);
        res.status(500).json({ success: false, message: 'Failed to create organizer' });
    }
};

exports.updateOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }

        const organizer = await RunClubOrganizerAccount.findById(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });

        if (req.body.name !== undefined) organizer.name = String(req.body.name).trim();
        if (req.body.phone !== undefined) organizer.phone = String(req.body.phone).trim();
        if (req.body.email !== undefined) organizer.email = String(req.body.email).trim().toLowerCase();
        if (req.body.isActive !== undefined) {
            organizer.isActive = !!req.body.isActive;
            // Keep status in sync when toggling active from edit form
            if (organizer.isActive && organizer.status !== 'approved') {
                organizer.status = 'approved';
                organizer.approvedAt = organizer.approvedAt || new Date();
                organizer.approvedBy = req.user?.userId || organizer.approvedBy;
                organizer.rejectedReason = '';
            }
            if (!organizer.isActive && organizer.status === 'approved') {
                // Soft deactivate without marking rejected
            }
        }

        if (req.body.username !== undefined) {
            const username = normalizeUsername(req.body.username);
            if (username.length < 3) {
                return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
            }
            const taken = await RunClubOrganizerAccount.findOne({ username, _id: { $ne: id } });
            if (taken) {
                return res.status(409).json({ success: false, message: 'Username already taken' });
            }
            organizer.username = username;
        }

        if (req.body.password) {
            const password = String(req.body.password);
            if (password.length < 8) {
                return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
            }
            organizer.passwordHash = await RunClubOrganizerAccount.hashPassword(password);
        }

        if (req.body.runClubId !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(req.body.runClubId)) {
                return res.status(400).json({ success: false, message: 'Invalid run club ID' });
            }
            const runClub = await RunClub.findById(req.body.runClubId).select('_id').lean();
            if (!runClub) {
                return res.status(400).json({ success: false, message: 'Run club not found' });
            }
            organizer.runClubId = req.body.runClubId;
        }

        // Backfill status for legacy accounts so schema default never locks them out
        if (!organizer.status) {
            organizer.status = organizer.isActive !== false ? 'approved' : 'rejected';
            if (organizer.status === 'approved' && !organizer.approvedAt) {
                organizer.approvedAt = new Date();
            }
        }

        await organizer.save();
        res.json({ success: true, message: 'Organizer updated', organizer: serializeOrganizer(organizer) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update organizer' });
    }
};

exports.approveOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }

        const organizer = await RunClubOrganizerAccount.findById(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });

        if (req.body.runClubId !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(req.body.runClubId)) {
                return res.status(400).json({ success: false, message: 'Invalid run club ID' });
            }
            const runClub = await RunClub.findById(req.body.runClubId).select('_id').lean();
            if (!runClub) {
                return res.status(400).json({ success: false, message: 'Run club not found' });
            }
            organizer.runClubId = req.body.runClubId;
        }

        if (!organizer.runClubId) {
            return res.status(400).json({ success: false, message: 'Assign a run club before approving' });
        }

        organizer.status = 'approved';
        organizer.isActive = true;
        organizer.approvedAt = new Date();
        organizer.approvedBy = req.user?.userId || null;
        organizer.rejectedReason = '';
        await organizer.save();

        res.json({
            success: true,
            message: 'Organizer approved — they can sign in now',
            organizer: serializeOrganizer(organizer),
        });
    } catch (error) {
        console.error('[adminRunClubOrganizer.approve]', error);
        res.status(500).json({ success: false, message: 'Failed to approve organizer' });
    }
};

exports.rejectOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }

        const organizer = await RunClubOrganizerAccount.findById(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });

        const reason = String(req.body.reason || '').trim();
        organizer.status = 'rejected';
        organizer.isActive = false;
        organizer.rejectedReason = reason;
        await organizer.save();

        res.json({
            success: true,
            message: 'Organizer access rejected',
            organizer: serializeOrganizer(organizer),
        });
    } catch (error) {
        console.error('[adminRunClubOrganizer.reject]', error);
        res.status(500).json({ success: false, message: 'Failed to reject organizer' });
    }
};

exports.deleteOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }
        const organizer = await RunClubOrganizerAccount.findByIdAndDelete(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });
        res.json({ success: true, message: 'Organizer deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete organizer' });
    }
};

const RunClubManagerProfileInvite = require('../model/run_club_manager_profile_invite_model');

function normalizeInviteEmail(email) {
    return String(email || '').trim().toLowerCase();
}

exports.listProfileInvites = async (req, res) => {
    try {
        const invites = await RunClubManagerProfileInvite.find()
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

        const existing = await RunClubManagerProfileInvite.findOne({ email });
        if (existing) {
            existing.isActive = true;
            if (note) existing.note = note;
            await existing.save();
            return res.json({
                success: true,
                message: 'Email re-activated for Club manager profile access',
                invite: existing,
            });
        }

        const invite = await RunClubManagerProfileInvite.create({
            email,
            note,
            isActive: true,
            createdBy: req.user?.userId || null,
        });

        res.status(201).json({
            success: true,
            message: 'Email approved — user will see Club manager in Profile',
            invite,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Email already added' });
        }
        console.error('[adminRunClubOrganizer.addProfileInvite]', error);
        res.status(500).json({ success: false, message: 'Failed to add email' });
    }
};

exports.removeProfileInvite = async (req, res) => {
    try {
        const { inviteId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(inviteId)) {
            return res.status(400).json({ success: false, message: 'Invalid invite ID' });
        }
        const invite = await RunClubManagerProfileInvite.findByIdAndDelete(inviteId);
        if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
        res.json({ success: true, message: 'Email removed from Club manager profile access' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove email' });
    }
};
