const express = require('express');
const router = express.Router();
const TrekCommunity = require('../model/trek_community_model');
const { findByIdOrSlug } = require('../utils/slug');

function stripCommunityGroupLink(community) {
    if (!community) return community;
    const { groupLink: _omit, ...rest } = community;
    return rest;
}

router.get('/', async (req, res) => {
    try {
        const requested = Number.parseInt(String(req.query.limit || ''), 10);
        const limit = Math.min(
            Number.isFinite(requested) && requested > 0 ? requested : 100,
            200,
        );
        const communities = await TrekCommunity.find({ status: 'published' })
            .sort({ trekPagePriority: 1, createdAt: -1 })
            .limit(limit)
            .lean();
        res.json({ communities: communities.map(stripCommunityGroupLink) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch communities' });
    }
});

router.get('/:idOrSlug', async (req, res) => {
    try {
        const community = await findByIdOrSlug(TrekCommunity, req.params.idOrSlug, {
            baseFilter: { status: 'published' },
            pickName: (row) => row.name,
            lean: true,
        });
        if (!community) return res.status(404).json({ message: 'Not found' });
        res.json({ community: stripCommunityGroupLink(community) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch community' });
    }
});

module.exports = router;
