const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');
const Competition = require('../model/competition_model');
const EventShow = require('../model/event_show_model');
const { CollegeGame } = require('../modules/college-platform/models');
const { buildSearchKeywords } = require('../utils/searchKeywords');
const { layoutCoverUrl } = require('../utils/sanitizeCoverImages');

const dbOk = () => mongoose.connection.readyState === 1;

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSmartRegexes = (query) => {
    const raw = String(query || '').trim();
    if (!raw) return [];

    const cleaned = raw.replace(/\b(fests?|festivals?|events?|competitions?|shows?|clubs?|treks?|games?)\b/gi, '').trim();

    const terms = new Set([raw]);
    if (cleaned.length >= 2) terms.add(cleaned);
    raw.split(/\s+/).forEach((w) => {
        if (w.length >= 2) terms.add(w);
    });

    if (/\b(cult|cultural)\b/i.test(raw)) terms.add('cultural');
    if (/\b(tech|technical)\b/i.test(raw)) terms.add('technical');
    if (/\b(sport|sports)\b/i.test(raw)) terms.add('sports');

    return Array.from(terms).map((t) => new RegExp(escapeRegex(t), 'i'));
};

exports.searchAll = async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ results: [] });

        const query = String(req.query.query || req.query.q || '').trim();
        if (!query) return res.json({ results: [] });

        const regexes = buildSmartRegexes(query);
        if (!regexes.length) return res.json({ results: [] });
        const perTypeLimit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
        const published = { $in: ['published', 'completed'] };
        const [fests, sports, runClubs, competitions, events, games] = await Promise.all([
            FestOrganizer.find({ isApproved: true, $or: [
                { festName: { $in: regexes } }, { collegeName: { $in: regexes } }, { description: { $in: regexes } },
                { festType: { $in: regexes } }, { venue: { $in: regexes } }, { location: { $in: regexes } }, { highlights: { $in: regexes } },
            ] }).select('festName collegeName description festType venue location coverImage coverImages startDate endDate slug').limit(perTypeLimit).lean(),
            SportsEvent.find({ status: published, $or: [
                { title: { $in: regexes } }, { sportType: { $in: regexes } }, { organizer: { $in: regexes } }, { venue: { $in: regexes } },
                { city: { $in: regexes } }, { distance: { $in: regexes } }, { runCategory: { $in: regexes } },
            ] }).select('title sportType organizer venue city distance coverImage coverImages slug previousSlugs eventDate runClubId').populate('runClubId', 'listingHub').limit(perTypeLimit).lean(),
            RunClub.find({ status: 'published', $or: [
                { name: { $in: regexes } }, { basedIn: { $in: regexes } }, { tagline: { $in: regexes } }, { organizer: { $in: regexes } },
                { aboutUs: { $in: regexes } }, { runCategories: { $in: regexes } },
            ] }).select('name basedIn tagline coverImage coverImages slug listingHub').limit(perTypeLimit).lean(),
            Competition.find({ isApproved: true, $or: [
                { name: { $in: regexes } }, { description: { $in: regexes } }, { competitionType: { $in: regexes } }, { subtitle: { $in: regexes } }, { venue: { $in: regexes } },
            ] }).select('name description competitionType subtitle venue coverImage dateTime').populate('fest', 'festName collegeName').limit(perTypeLimit).lean(),
            EventShow.find({ status: published, $or: [
                { title: { $in: regexes } }, { displayName: { $in: regexes } }, { description: { $in: regexes } }, { eventType: { $in: regexes } },
                { eventHeading: { $in: regexes } }, { organizer: { $in: regexes } }, { venue: { $in: regexes } }, { city: { $in: regexes } }, { cast: { $in: regexes } },
            ] }).select('title displayName description eventType eventHeading organizer venue city poster banner coverImage coverImages showTimings').limit(perTypeLimit).lean(),
            CollegeGame.find({ status: 'published', $or: [
                { title: { $in: regexes } }, { description: { $in: regexes } }, { city: { $in: regexes } }, { venue: { $in: regexes } },
            ] }).select('title description city venue coverImage slug startsAt').limit(perTypeLimit).lean(),
        ]);

        const result = (item, resultType, title, subtitle, image, extra = {}) => ({
            id: item._id, title, subtitle, image, resultType,
            coverImage: item.coverImage || item.poster || item.banner || image || '',
            coverImages: item.coverImages || undefined,
            ...extra,
        });
        const thumb = (item, fallback) => layoutCoverUrl(item.coverImages, 'portrait', fallback || item.coverImage);
        const results = [
            ...fests.map((x) => result(x, 'fest', x.festName, x.collegeName || x.venue, thumb(x), { description: x.description, category: x.festType, slug: x.slug })),
            ...competitions.map((x) => result(x, 'competition', x.name, x.fest?.festName || x.subtitle || x.venue, x.coverImage, { description: x.description, category: x.competitionType })),
            ...sports.map((x) => result(x, 'sport', x.title, x.city || x.venue || x.sportType, thumb(x), { slug: x.slug, previousSlugs: x.previousSlugs, listingHub: x.runClubId?.listingHub })),
            ...runClubs.map((x) => result(x, 'runclub', x.name, x.basedIn || x.tagline, thumb(x), { slug: x.slug, listingHub: x.listingHub })),
            ...events.map((x) => result(x, 'events', x.title, x.city || x.organizer || x.eventHeading, thumb(x, x.poster || x.banner), { description: x.description })),
            ...games.map((x) => result(x, 'game', x.title, x.city || x.venue, x.coverImage, { description: x.description, slug: x.slug })),
        ];

        res.set('Cache-Control', 'public, max-age=30');
        res.json({ results, count: results.length });
    } catch (error) {
        console.error('[search] all error:', error.message);
        res.status(500).json({ results: [], message: 'Failed to search' });
    }
};

exports.getKeywords = async (req, res) => {
    try {
        if (!dbOk()) {
            return res.status(503).json({ keywords: [] });
        }

        const [fests, sports, runClubs, competitions, events, games] = await Promise.all([
            FestOrganizer.find({ isApproved: true })
                .select('festName collegeName festType venue location highlights')
                .sort({ homePriority: 1, createdAt: -1 })
                .limit(120)
                .lean(),
            SportsEvent.find({ status: 'published', showOnSportsPage: { $ne: false } })
                .select('title city sportType')
                .sort({ priority: 1, createdAt: -1 })
                .limit(60)
                .lean(),
            RunClub.find({
                status: 'published',
                $or: [
                    { showInRunClubs: { $ne: false }, listingHub: { $ne: 'events' } },
                    { listingHub: 'events' },
                ],
            })
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
            CollegeGame.find({ status: 'published' })
                .select('title city venue')
                .sort({ startsAt: 1 })
                .limit(80)
                .lean(),
        ]);

        const keywords = buildSearchKeywords({
            fests,
            treks: [],
            communities: [],
            sports,
            runClubs,
            competitions,
            events,
        });

        for (const game of games) {
            keywords.push(game.title, game.city, game.venue);
        }
        const uniqueKeywords = [...new Set(keywords.map((item) => String(item || '').trim()).filter(Boolean))];

        res.set('Cache-Control', 'public, max-age=300');
        res.json({ keywords: uniqueKeywords, count: uniqueKeywords.length });
    } catch (error) {
        console.error('[search] keywords error:', error.message);
        res.status(500).json({ keywords: [], message: 'Failed to load search keywords' });
    }
};
