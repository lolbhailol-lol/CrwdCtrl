const { toSlug } = require('./slug');

const Trek = require('../model/trek_model');
const FestOrganizer = require('../model/fest_organizer_model');
const RunClub = require('../model/run_club_model');
const SportsEvent = require('../model/sports_model');
const TrekCommunity = require('../model/trek_community_model');
const EventShow = require('../model/event_show_model');
const Competition = require('../model/competition_model');

function slugOrId(name, id) {
    const slug = toSlug(name);
    return slug || String(id);
}

function addMapping(map, from, to) {
    if (from && to && from !== to) {
        map.set(from, to);
    }
}

/**
 * Build a lookup of legacy Mongo ID paths → canonical slug paths.
 * Used to merge historical analytics and GA4 page reports.
 */
async function buildSlugPathLookup() {
    const [treks, fests, clubs, runs, communities, shows, competitions] = await Promise.all([
        Trek.find().select('trekName').lean(),
        FestOrganizer.find().select('festName').lean(),
        RunClub.find().select('name').lean(),
        SportsEvent.find().select('title').lean(),
        TrekCommunity.find().select('name').lean(),
        EventShow.find().select('title displayName').lean(),
        Competition.find().select('name fest').lean(),
    ]);

    const map = new Map();

    for (const trek of treks) {
        const id = String(trek._id);
        const slug = slugOrId(trek.trekName, id);
        addMapping(map, `/trek/${id}`, `/trek/${slug}`);
        addMapping(map, `/trek/${id}/book`, `/trek/${slug}/book`);
    }

    const festSlugById = new Map();
    for (const fest of fests) {
        const id = String(fest._id);
        const slug = slugOrId(fest.festName, id);
        festSlugById.set(id, slug);
        addMapping(map, `/view-details/${id}`, `/view-details/${slug}`);
        addMapping(map, `/fest/${id}/register`, `/fest/${slug}/register`);
    }

    for (const club of clubs) {
        const id = String(club._id);
        const slug = slugOrId(club.name, id);
        addMapping(map, `/sports/run-club/${id}`, `/sports/run-club/${slug}`);
    }

    for (const run of runs) {
        const id = String(run._id);
        const slug = slugOrId(run.title, id);
        addMapping(map, `/sports/run/${id}`, `/sports/run/${slug}`);
        addMapping(map, `/sports/run/${id}/book`, `/sports/run/${slug}/book`);
    }

    for (const community of communities) {
        const id = String(community._id);
        const slug = slugOrId(community.name, id);
        addMapping(map, `/treks/community/${id}`, `/treks/community/${slug}`);
    }

    for (const show of shows) {
        const id = String(show._id);
        const slug = slugOrId(show.displayName || show.title, id);
        addMapping(map, `/events/${id}`, `/events/${slug}`);
        addMapping(map, `/events/${id}/register`, `/events/${slug}/register`);
    }

    for (const competition of competitions) {
        const id = String(competition._id);
        const slug = slugOrId(competition.name, id);
        addMapping(map, `/competitions-view-details/${id}`, `/competitions-view-details/${slug}`);
        addMapping(map, `/competition-registration/${id}`, `/competition-registration/${slug}`);
        const parentFestId = competition.fest ? String(competition.fest) : '';
        if (parentFestId) {
            const festSlug = festSlugById.get(parentFestId) || parentFestId;
            addMapping(map, `/fest/${parentFestId}/register/${id}`, `/fest/${festSlug}/register/${slug}`);
            addMapping(map, `/fest/${festSlug}/register/${id}`, `/fest/${festSlug}/register/${slug}`);
        }
    }

    return map;
}

function normalizePagePath(path = '', lookup) {
    const base = String(path || '').split('?')[0];
    if (!lookup) return base;
    return lookup.get(base) || base;
}

function mergePageViewStats(rows = [], lookup) {
    const merged = new Map();

    for (const row of rows) {
        const page = row.page ?? row.key ?? '';
        const value = Number(row.value ?? row.pageViews ?? 0);
        const canonical = normalizePagePath(page, lookup);
        merged.set(canonical, (merged.get(canonical) || 0) + value);
    }

    return [...merged.entries()]
        .map(([page, value]) => ({ page, value }))
        .sort((a, b) => b.value - a.value);
}

module.exports = {
    buildSlugPathLookup,
    normalizePagePath,
    mergePageViewStats,
};
