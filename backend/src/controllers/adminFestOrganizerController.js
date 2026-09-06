const mongoose = require('mongoose');
const FestOrganizerAccount = require('../model/fest_organizer_account_model');
const FestOrganizer = require('../model/fest_organizer_model');
const FestOrganizerProfileInvite = require('../model/fest_organizer_profile_invite_model');
const { normalizeUsername } = require('../utils/normalizeUsername');

function serializeOrganizer(org) {
    const plain = typeof org.toObject === 'function' ? org.toObject() : { ...org };
    const { passwordHash: _omit, ...safe } = plain;
    return {
        ...safe,
        status: FestOrganizerAccount.effectiveStatus(safe),
    };
}

function normalizeInviteEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function parseFestIds(raw) {
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return list
        .map((id) => String(id || '').trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
}

exports.listOrganizers = async (req, res) => {
    try {
        await FestOrganizerAccount.ensureSparseEmailIndex();

        const filter = {};
        const statusQ = String(req.query.status || '').toLowerCase();
        if (['pending', 'approved', 'rejected'].includes(statusQ)) {
            filter.status = statusQ;
        }

        const organizers = await FestOrganizerAccount.find(filter)
            .select('-passwordHash')
            .populate('assignedFestIds', 'festName collegeName city')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            organizers: organizers.map((o) => serializeOrganizer(o)),
            pendingCount: await FestOrganizerAccount.countDocuments({ status: 'pending' }),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to list organizers' });
    }
};

exports.createOrganizer = async (req, res) => {
    try {
        await FestOrganizerAccount.ensureSparseEmailIndex();

        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();
        const email = FestOrganizerAccount.normalizeOptionalEmail(req.body.email);
        const assignedFestIds = parseFestIds(req.body.assignedFestIds);

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (username.length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        if (!assignedFestIds.length) {
            return res.status(400).json({ success: false, message: 'Assign at least one fest' });
        }

        const fests = await FestOrganizer.find({ _id: { $in: assignedFestIds } }).select('_id').lean();
        if (fests.length !== assignedFestIds.length) {
            return res.status(400).json({ success: false, message: 'One or more fests were not found' });
        }

        const existing = await FestOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }
        if (email) {
            const emailTaken = await FestOrganizerAccount.findOne({ email });
            if (emailTaken) {
                return res.status(409).json({ success: false, message: 'Email already used by another organizer' });
            }
        }

        const now = new Date();
        const payload = {
            name,
            username,
            passwordHash: await FestOrganizerAccount.hashPassword(password),
            phone,
            assignedFestIds,
            status: 'approved',
            isActive: true,
            approvedAt: now,
            approvedBy: req.user?.userId || null,
            createdBy: req.user?.userId || null,
        };
        if (email) payload.email = email;

        const organizer = await FestOrganizerAccount.create(payload);
        res.status(201).json({
            success: true,
            message: 'Fest organizer account created',
            organizer: serializeOrganizer(organizer),
        });
    } catch (error) {
        console.error('[adminFestOrganizer.create]', error);
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username or email already taken' });
        }
        res.status(500).json({ success: false, message: 'Failed to create organizer' });
    }
};

exports.updateOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }

        const organizer = await FestOrganizerAccount.findById(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });

        if (req.body.name !== undefined) organizer.name = String(req.body.name).trim();
        if (req.body.phone !== undefined) organizer.phone = String(req.body.phone).trim();
        if (req.body.email !== undefined) {
            const nextEmail = FestOrganizerAccount.normalizeOptionalEmail(req.body.email);
            if (nextEmail) {
                const emailTaken = await FestOrganizerAccount.findOne({ email: nextEmail, _id: { $ne: id } });
                if (emailTaken) {
                    return res.status(409).json({ success: false, message: 'Email already used by another organizer' });
                }
                organizer.email = nextEmail;
            } else {
                organizer.email = undefined;
                organizer.set('email', undefined);
            }
        }
        if (req.body.assignedFestIds !== undefined) {
            const assignedFestIds = parseFestIds(req.body.assignedFestIds);
            if (!assignedFestIds.length) {
                return res.status(400).json({ success: false, message: 'Assign at least one fest' });
            }
            const fests = await FestOrganizer.find({ _id: { $in: assignedFestIds } }).select('_id').lean();
            if (fests.length !== assignedFestIds.length) {
                return res.status(400).json({ success: false, message: 'One or more fests were not found' });
            }
            organizer.assignedFestIds = assignedFestIds;
        }
        if (req.body.password) {
            if (String(req.body.password).length < 8) {
                return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
            }
            organizer.passwordHash = await FestOrganizerAccount.hashPassword(req.body.password);
        }
        if (req.body.isActive !== undefined) {
            organizer.isActive = Boolean(req.body.isActive);
            if (organizer.isActive && FestOrganizerAccount.effectiveStatus(organizer) !== 'approved') {
                organizer.status = 'approved';
                organizer.approvedAt = organizer.approvedAt || new Date();
                organizer.approvedBy = req.user?.userId || organizer.approvedBy;
                organizer.rejectedReason = '';
            }
        }

        await organizer.save();
        res.json({ success: true, organizer: serializeOrganizer(organizer) });
    } catch (error) {
        console.error('[adminFestOrganizer.update]', error);
        res.status(500).json({ success: false, message: 'Failed to update organizer' });
    }
};

exports.approveOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        const assignedFestIds = parseFestIds(req.body.assignedFestIds);

        const organizer = await FestOrganizerAccount.findById(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });

        const festIds = assignedFestIds.length
            ? assignedFestIds
            : (organizer.assignedFestIds || []).map((x) => String(x));

        if (!festIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Assign at least one fest before approving',
            });
        }

        const fests = await FestOrganizer.find({ _id: { $in: festIds } }).select('_id').lean();
        if (fests.length !== festIds.length) {
            return res.status(400).json({ success: false, message: 'One or more fests were not found' });
        }

        organizer.assignedFestIds = festIds;
        organizer.status = 'approved';
        organizer.isActive = true;
        organizer.approvedAt = new Date();
        organizer.approvedBy = req.user?.userId || null;
        organizer.rejectedReason = '';
        await organizer.save();

        res.json({ success: true, message: 'Organizer approved', organizer: serializeOrganizer(organizer) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to approve organizer' });
    }
};

exports.rejectOrganizer = async (req, res) => {
    try {
        const organizer = await FestOrganizerAccount.findById(req.params.id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });

        organizer.status = 'rejected';
        organizer.isActive = false;
        organizer.rejectedReason = String(req.body.reason || '').trim();
        await organizer.save();

        res.json({ success: true, message: 'Organizer rejected', organizer: serializeOrganizer(organizer) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to reject organizer' });
    }
};

exports.deleteOrganizer = async (req, res) => {
    try {
        const deleted = await FestOrganizerAccount.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Organizer not found' });
        res.json({ success: true, message: 'Organizer deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete organizer' });
    }
};

exports.listProfileInvites = async (req, res) => {
    try {
        const invites = await FestOrganizerProfileInvite.find({ isActive: true })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, invites });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to list invites' });
    }
};

exports.addProfileInvite = async (req, res) => {
    try {
        const email = normalizeInviteEmail(req.body.email);
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'Valid email required' });
        }
        const note = String(req.body.note || '').trim();
        const invite = await FestOrganizerProfileInvite.findOneAndUpdate(
            { email },
            {
                email,
                note,
                isActive: true,
                createdBy: req.user?.userId || null,
            },
            { upsert: true, new: true },
        );
        res.status(201).json({ success: true, invite });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add invite' });
    }
};

exports.removeProfileInvite = async (req, res) => {
    try {
        const invite = await FestOrganizerProfileInvite.findByIdAndUpdate(
            req.params.inviteId,
            { isActive: false },
            { new: true },
        );
        if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
        res.json({ success: true, message: 'Invite removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove invite' });
    }
};
