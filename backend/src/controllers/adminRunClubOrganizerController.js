const mongoose = require('mongoose');
const RunClubOrganizerAccount = require('../model/run_club_organizer_account_model');
const RunClub = require('../model/run_club_model');
const { normalizeUsername } = require('../utils/runClubOrganizerAccess');

exports.listOrganizers = async (req, res) => {
    try {
        const organizers = await RunClubOrganizerAccount.find()
            .populate('runClubId', 'name basedIn')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, organizers });
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

        const organizer = await RunClubOrganizerAccount.create({
            name,
            username,
            email,
            passwordHash: await RunClubOrganizerAccount.hashPassword(password),
            phone,
            runClubId,
            createdBy: req.user?.userId || null,
        });

        res.status(201).json({
            success: true,
            message: 'Run club organizer account created',
            organizer: {
                id: organizer._id,
                name: organizer.name,
                username: organizer.username,
                email: organizer.email,
                phone: organizer.phone,
                runClubId: organizer.runClubId,
                isActive: organizer.isActive,
            },
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
        if (req.body.isActive !== undefined) organizer.isActive = !!req.body.isActive;

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
        const organizer = await RunClubOrganizerAccount.findByIdAndDelete(id);
        if (!organizer) return res.status(404).json({ success: false, message: 'Organizer not found' });
        res.json({ success: true, message: 'Organizer deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete organizer' });
    }
};
