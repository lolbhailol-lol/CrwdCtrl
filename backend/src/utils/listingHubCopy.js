const RunClub = require('../model/run_club_model');

function isEventsListingHub(source) {
    if (!source) return false;
    if (typeof source === 'string') return source === 'events';
    const nested = source.runClubId;
    const hub = source.listingHub
        || source.runClub?.listingHub
        || source.club?.listingHub
        || (nested && typeof nested === 'object' ? nested.listingHub : null);
    return hub === 'events';
}

function sportsActivityNoun(source) {
    return isEventsListingHub(source) ? 'event' : 'run';
}

function sportsNotFoundMessage(source, { orNotPublished = false } = {}) {
    const cap = isEventsListingHub(source) ? 'Event' : 'Run';
    return orNotPublished ? `${cap} not found or not published` : `${cap} not found`;
}

async function listingHubForRunClubId(runClubId) {
    if (!runClubId) return 'sports';
    if (typeof runClubId === 'object' && runClubId.listingHub) {
        return runClubId.listingHub === 'events' ? 'events' : 'sports';
    }
    const id = runClubId._id || runClubId;
    const club = await RunClub.findById(id).select('listingHub').lean();
    return club?.listingHub === 'events' ? 'events' : 'sports';
}

function hubSourceFromListing(listingHub) {
    return { listingHub: listingHub === 'events' ? 'events' : 'sports' };
}

module.exports = {
    isEventsListingHub,
    sportsActivityNoun,
    sportsNotFoundMessage,
    listingHubForRunClubId,
    hubSourceFromListing,
};
