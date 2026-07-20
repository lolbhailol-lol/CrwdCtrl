const mongoose = require('mongoose');
const TrekOrganizerAccount = require('../model/trek_organizer_account_model');
const TrekCommunity = require('../model/trek_community_model');
const TrekCommunityManagerProfileInvite = require('../model/trek_community_manager_profile_invite_model');
const { normalizeUsername } = require('../utils/trekOrganizerAccess');

function serializeOrganizer(org) {
    const plain = typeof org.toObject === 'function' ? org.toObject() : { ...org };
    const status = TrekOrganizerAccount.effectiveStatus(plain);
    return {
        ...plain,
        status,
        passwordHash: undefined,
    };
}

function normalizeInviteEmail(email) {
    return String(email || '').trim().toLowerCase();
}

exports.listOrganizers = async (req, res) => {
    try {
        await TrekOrganizerAccount.ensureSparseEmailIndex();

        const filter = {};
        const statusQ = String(req.query.status || '').toLowerCase();
        if (['pending', 'approved', 'rejected'].includes(statusQ)) {
            if (statusQ === 'approved') {
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

        const organizers = await TrekOrganizerAccount.find(filter)
            .select('-passwordHash')
            .populate('communityId', 'name basedIn')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            organizers: organizers.map((o) => serializeOrganizer(o)),
            pendingCount: await TrekOrganizerAccount.countDocuments({ status: 'pending' }),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to list organizers' });
    }
};

exports.createOrganizer = async (req, res) => {
    try {
        await TrekOrganizerAccount.ensureSparseEmailIndex();

        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();
        const email = TrekOrganizerAccount.normalizeOptionalEmail(req.body.email);
        const communityId = req.body.communityId;

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (username.length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters (letters, numbers, underscore)' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
            return res.status(400).json({ success: false, message: 'A valid trek community is required' });
        }

        const community = await TrekCommunity.findById(communityId).select('_id name').lean();
        if (!community) {
            return res.status(400).json({ success: false, message: 'Trek community not found' });
        }

        const existing = await TrekOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }

        if (email) {
            const emailTaken = await TrekOrganizerAccount.findOne({ email });
            if (emailTaken) {
                return res.status(409).json({ success: false, message: 'Email already used by another organizer' });
            }
        }

        const now = new Date();
        const payload = {
            name,
            username,
            passwordHash: await TrekOrganizerAccount.hashPassword(password),
            phone,
            communityId,
            status: 'approved',
            isActive: true,
            approvedAt: now,
            approvedBy: req.user?.userId || null,
            createdBy: req.user?.userId || null,
        };
        if (email) payload.email = email;

        const organizer = await TrekOrganizerAccount.create(payload);

        res.status(201).json({
            success: true,
            message: 'Community organizer account created',
            organizer: serializeOrganizer(organizer),
        });
    } catch (error) {
        console.error('[adminTrekOrganizer.create]', error);
        if (error?.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0] || 'field';
            if (field === 'email') {
                return res.status(409).json({
                    success: false,
                    message: 'Email already used (leave email blank or use a unique email)',
                });
            }
            if (field === 'username') {
                return res.status(409).json({ success: false, message: 'Username already taken' });
            }
            return res.status(409).json({ success: false, message: `Duplicate ${field}` });
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

        const organizer = await TrekOrganizerAccount.findById(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });

        if (req.body.name !== undefined) organizer.name = String(req.body.name).trim();
        if (req.body.phone !== undefined) organizer.phone = String(req.body.phone).trim();
        if (req.body.email !== undefined) {
            const nextEmail = TrekOrganizerAccount.normalizeOptionalEmail(req.body.email);
            if (nextEmail) {
                const emailTaken = await TrekOrganizerAccount.findOne({ email: nextEmail, _id: { $ne: id } });
                if (emailTaken) {
                    return res.status(409).json({ success: false, message: 'Email already used by another organizer' });
                }
                organizer.email = nextEmail;
            } else {
                organizer.email = undefined;
                organizer.set('email', undefined);
            }
        }
        if (req.body.communityId !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(req.body.communityId)) {
                return res.status(400).json({ success: false, message: 'Invalid community ID' });
            }
            const community = await TrekCommunity.findById(req.body.communityId).select('_id').lean();
            if (!community) {
                return res.status(400).json({ success: false, message: 'Trek community not found' });
            }
            organizer.communityId = req.body.communityId;
        }
        if (req.body.password) {
            if (String(req.body.password).length < 8) {
                return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
            }
            organizer.passwordHash = await TrekOrganizerAccount.hashPassword(req.body.password);
        }
        if (req.body.isActive !== undefined) {
            organizer.isActive = Boolean(req.body.isActive);
            if (organizer.isActive && TrekOrganizerAccount.effectiveStatus(organizer) !== 'approved') {
                organizer.status = 'approved';
                organizer.approvedAt = organizer.approvedAt || new Date();
                organizer.approvedBy = req.user?.userId || organizer.approvedBy;
                organizer.rejectedReason = '';
            }
            if (!organizer.isActive && organizer.status === 'approved') {
                // Soft-deactivate without rejecting permanently
            }
        }
        if (!organizer.status) {
            organizer.status = organizer.isActive !== false ? 'approved' : 'rejected';
            if (organizer.status === 'approved' && !organizer.approvedAt) {
                organizer.approvedAt = new Date();
            }
        }

        await organizer.save();
        res.json({
            success: true,
            message: 'Organizer updated',
            organizer: serializeOrganizer(organizer),
        });
    } catch (error) {
        console.error('[adminTrekOrganizer.update]', error);
        res.status(500).json({ success: false, message: 'Failed to update organizer' });
    }
};

exports.approveOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }

        const organizer = await TrekOrganizerAccount.findById(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });

        if (req.body.communityId !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(req.body.communityId)) {
                return res.status(400).json({ success: false, message: 'Invalid community ID' });
            }
            const community = await TrekCommunity.findById(req.body.communityId).select('_id').lean();
            if (!community) {
                return res.status(400).json({ success: false, message: 'Trek community not found' });
            }
            organizer.communityId = req.body.communityId;
        }

        if (!organizer.communityId) {
            return res.status(400).json({ success: false, message: 'Assign a trek community before approving' });
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
        console.error('[adminTrekOrganizer.approve]', error);
        res.status(500).json({ success: false, message: 'Failed to approve organizer' });
    }
};

exports.rejectOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }

        const organizer = await TrekOrganizerAccount.findById(id);
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
        console.error('[adminTrekOrganizer.reject]', error);
        res.status(500).json({ success: false, message: 'Failed to reject organizer' });
    }
};

exports.deleteOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid organizer ID' });
        }
        const organizer = await TrekOrganizerAccount.findByIdAndDelete(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });
        res.json({ success: true, message: 'Organizer deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete organizer' });
    }
};

exports.listProfileInvites = async (req, res) => {
    try {
        const invites = await TrekCommunityManagerProfileInvite.find()
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

        const existing = await TrekCommunityManagerProfileInvite.findOne({ email });
        if (existing) {
            existing.isActive = true;
            if (note) existing.note = note;
            await existing.save();
            return res.json({
                success: true,
                message: 'Profile email re-activated',
                invite: existing,
            });
        }

        const invite = await TrekCommunityManagerProfileInvite.create({
            email,
            note,
            createdBy: req.user?.userId || null,
        });
        res.status(201).json({
            success: true,
            message: 'Email approved for Profile → Trek community',
            invite,
        });
    } catch (error) {
        console.error('[adminTrekOrganizer.addProfileInvite]', error);
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: 'Email already on the list' });
        }
        res.status(500).json({ success: false, message: 'Failed to add profile invite' });
    }
};

exports.removeProfileInvite = async (req, res) => {
    try {
        const { inviteId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(inviteId)) {
            return res.status(400).json({ success: false, message: 'Invalid invite ID' });
        }
        const invite = await TrekCommunityManagerProfileInvite.findByIdAndDelete(inviteId);
        if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
        res.json({ success: true, message: 'Profile email removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove profile invite' });
    }
};
