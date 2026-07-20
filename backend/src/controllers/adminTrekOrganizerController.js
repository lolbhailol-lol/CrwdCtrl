const mongoose = require('mongoose');
const TrekOrganizerAccount = require('../model/trek_organizer_account_model');
const TrekCommunity = require('../model/trek_community_model');
const { normalizeUsername } = require('../utils/trekOrganizerAccess');

exports.listOrganizers = async (req, res) => {
    try {
        const organizers = await TrekOrganizerAccount.find()
            .populate('communityId', 'name basedIn')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, organizers });
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

        const payload = {
            name,
            username,
            passwordHash: await TrekOrganizerAccount.hashPassword(password),
            phone,
            communityId,
            createdBy: req.user?.userId || null,
        };
        if (email) payload.email = email;

        const organizer = await TrekOrganizerAccount.create(payload);

        res.status(201).json({
            success: true,
            message: 'Community organizer account created',
            organizer: {
                id: organizer._id,
                name: organizer.name,
                username: organizer.username,
                email: organizer.email || '',
                phone: organizer.phone,
                communityId: organizer.communityId,
                isActive: organizer.isActive,
            },
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
                // Remove blank email so sparse unique index never sees ""
                organizer.email = undefined;
                organizer.$unset('email');
            }
        }
        if (req.body.isActive !== undefined) organizer.isActive = !!req.body.isActive;

        if (req.body.username !== undefined) {
            const username = normalizeUsername(req.body.username);
            if (username.length < 3) {
                return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
            }
            const taken = await TrekOrganizerAccount.findOne({ username, _id: { $ne: id } });
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
            organizer.passwordHash = await TrekOrganizerAccount.hashPassword(password);
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

        await organizer.save();
        res.json({ success: true, message: 'Organizer updated', organizer });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update organizer' });
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
