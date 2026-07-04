const express = require('express');
const router = express.Router();
const TrekCommunity = require('../model/trek_community_model');

function stripCommunityGroupLink(community) {
    if (!community) return community;
    const { groupLink: _omit, ...rest } = community;
    return rest;
}

router.get('/', async (req, res) => {
    try {
        const communities = await TrekCommunity.find({ status: 'published' })
            .sort({ trekPagePriority: 1, createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ communities: communities.map(stripCommunityGroupLink) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch communities' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const community = await TrekCommunity.findOne({ _id: req.params.id, status: 'published' }).lean();
        if (!community) return res.status(404).json({ message: 'Not found' });
        res.json({ community: stripCommunityGroupLink(community) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch community' });
    }
});

module.exports = router;
