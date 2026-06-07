const express = require('express');
const router = express.Router();
const RunClub = require('../model/run_club_model');

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
        res.json({ clubs });
    } catch (err) {
        console.error('publicRunClub getAll error:', err.message);
        res.status(500).json({ message: 'Failed to fetch run clubs' });
    }
});

module.exports = router;
