const express = require('express');
const router = express.Router();
const RunClub = require('../model/run_club_model');
const { findByIdOrSlug } = require('../utils/slug');
const { sanitizePublicRunClub } = require('../utils/publicEntitySanitize');

router.get('/', async (req, res) => {
    try {
        const clubs = await RunClub.find({
            status: 'published',
            showOnSportsPage: { $ne: false },
            showInRunClubs: { $ne: false },
        })
            .sort({ runClubPriority: 1, createdAt: -1 })
            .limit(100)
            .lean();
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.json({ clubs: clubs.map(sanitizePublicRunClub) });
    } catch (err) {
        console.error('publicRunClub getAll error:', err.message);
        res.status(500).json({ message: 'Failed to fetch run clubs' });
    }
});

router.get('/:idOrSlug', async (req, res) => {
    try {
        const club = await findByIdOrSlug(RunClub, req.params.idOrSlug, {
            baseFilter: {
            status: 'published',
            showOnSportsPage: { $ne: false },
            },
            pickName: (row) => row.name,
            lean: true,
        });
        if (!club) return res.status(404).json({ message: 'Run club not found' });
        res.json({ club: sanitizePublicRunClub(club) });
    } catch (err) {
        console.error('publicRunClub getById error:', err.message);
        res.status(500).json({ message: 'Failed to fetch run club' });
    }
});

module.exports = router;
