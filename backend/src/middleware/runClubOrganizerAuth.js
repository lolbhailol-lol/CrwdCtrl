const jwt = require('jsonwebtoken');
const RunClubOrganizerAccount = require('../model/run_club_organizer_account_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { organizerCanAccessEvent, getOrganizerRunClub } = require('../utils/runClubOrganizerAccess');

async function authenticateRunClubOrganizer(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Organizer token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getJwtSecret());

        if (decoded.role !== 'run_club_organizer' || !decoded.organizerId) {
            return res.status(403).json({ success: false, message: 'Invalid organizer session' });
        }

        const organizer = await RunClubOrganizerAccount.findById(decoded.organizerId).lean();
        if (!organizer || !RunClubOrganizerAccount.canLogin(organizer)) {
            return res.status(401).json({ success: false, message: 'Organizer account inactive or not found' });
        }

        req.organizer = organizer;
        req.organizerId = organizer._id;
        const club = await getOrganizerRunClub(organizer);
        req.listingHub = club?.listingHub === 'events' ? 'events' : 'sports';
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Session expired — please log in again' });
        }
        return res.status(401).json({ success: false, message: 'Invalid organizer token' });
    }
}

async function requireEventAccess(req, res, next) {
    try {
        const eventId = String(req.params.eventId || '');
        if (!eventId) {
            return res.status(400).json({ success: false, message: 'Event ID required' });
        }

        const access = await organizerCanAccessEvent(req.organizer, eventId);
        if (!access.allowed || !access.eventId) {
            return res.status(403).json({
                success: false,
                message: req.listingHub === 'events'
                    ? 'You do not have access to this event'
                    : 'You do not have access to this run',
            });
        }

        // Always store resolved Mongo id (URL may be a title slug)
        req.eventId = access.eventId;
        next();
    } catch (error) {
        console.error('[requireEventAccess]', error.message);
        return res.status(500).json({ success: false, message: 'Access check failed' });
    }
}

module.exports = { authenticateRunClubOrganizer, requireEventAccess };
