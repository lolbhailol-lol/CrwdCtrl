const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const TrekCommunity = require('../model/trek_community_model');
const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');
const Competition = require('../model/competition_model');
const EventShow = require('../model/event_show_model');
const { buildSearchKeywords } = require('../utils/searchKeywords');

const dbOk = () => mongoose.connection.readyState === 1;

exports.getKeywords = async (req, res) => {
    try {
        if (!dbOk()) {
            return res.status(503).json({ keywords: [] });
        }

        const [fests, treks, communities, sports, runClubs, competitions, events] = await Promise.all([
            FestOrganizer.find({ isApproved: true })
                .select('festName collegeName festType venue location highlights')
                .sort({ homePriority: 1, createdAt: -1 })
                .limit(120)
                .lean(),
            Trek.find({ status: 'published' })
                .select('trekName city startingPoint trekCategory difficultyLevel')
                .sort({ priority: 1, createdAt: -1 })
                .limit(80)
                .lean(),
            TrekCommunity.find({ status: 'published', showOnTreks: { $ne: false } })
                .select('name basedIn trekCategories')
                .sort({ trekPagePriority: 1, createdAt: -1 })
                .limit(60)
                .lean(),
            SportsEvent.find({ status: 'published', showOnSportsPage: { $ne: false } })
                .select('title city sportType')
                .sort({ priority: 1, createdAt: -1 })
                .limit(60)
                .lean(),
            RunClub.find({ status: 'published', showInRunClubs: { $ne: false } })
                .select('name basedIn')
                .sort({ runClubPriority: 1, createdAt: -1 })
                .limit(40)
                .lean(),
            Competition.find({ isApproved: true })
                .select('name competitionType')
                .sort({ createdAt: -1 })
                .limit(80)
                .lean(),
            EventShow.find({ status: 'published' })
                .select('title city eventType')
                .sort({ priority: 1, createdAt: -1 })
                .limit(40)
                .lean(),
        ]);

        const keywords = buildSearchKeywords({
            fests,
            treks,
            communities,
            sports,
            runClubs,
            competitions,
            events,
        });

        res.set('Cache-Control', 'public, max-age=300');
        res.json({ keywords, count: keywords.length });
    } catch (error) {
        console.error('[search] keywords error:', error.message);
        res.status(500).json({ keywords: [], message: 'Failed to load search keywords' });
    }
};
