const RunClub = require('../model/run_club_model');
const SportsEvent = require('../model/sports_model');
const { findByIdOrSlug } = require('./slug');

/**
 * Resolve WhatsApp group / chat link for a run-club sports event.
 * Prefers club.groupLink; falls back to wa.me from club contact phone.
 */
async function resolveRunClubGroupLink(eventIdOrEvent, { runClubId } = {}) {
    let event = eventIdOrEvent;
    if (!event || typeof event === 'string' || event._bsontype === 'ObjectId') {
        event = await findByIdOrSlug(SportsEvent, eventIdOrEvent, {
            pickName: (row) => row.title || '',
            lean: true,
            select: 'runClubId title',
        });
    }
    const clubId = runClubId || event?.runClubId;
    if (!clubId) return { groupLink: '', communityName: '', eventTitle: event?.title || 'your run' };

    const club = await RunClub.findById(clubId).select('name groupLink contactPhone').lean();
    if (!club) return { groupLink: '', communityName: '', eventTitle: event?.title || 'your run' };

    let groupLink = String(club.groupLink || '').trim();
    if (!groupLink) {
        const digits = String(club.contactPhone || '').replace(/\D/g, '');
        if (digits.length >= 10) {
            const phone = digits.length === 10 ? `91${digits}` : digits;
            groupLink = `https://wa.me/${phone}`;
        }
    }

    return {
        groupLink,
        communityName: club.name || '',
        eventTitle: event?.title || 'your run',
    };
}

module.exports = { resolveRunClubGroupLink };
