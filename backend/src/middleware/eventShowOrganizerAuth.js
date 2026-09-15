const jwt = require('jsonwebtoken');
const EventShowOrganizerAccount = require('../model/event_show_organizer_account_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { organizerCanAccessEvent } = require('../utils/eventShowOrganizerAccess');

async function authenticateEventShowOrganizer(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Organizer token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getJwtSecret());

        if (decoded.role !== 'event_organizer' || !decoded.organizerId) {
            return res.status(403).json({ success: false, message: 'Invalid organizer session' });
        }

        const organizer = await EventShowOrganizerAccount.findById(decoded.organizerId).lean();
        if (!organizer || !EventShowOrganizerAccount.canLogin(organizer)) {
            return res.status(401).json({ success: false, message: 'Organizer account inactive or not found' });
        }

        req.organizer = organizer;
        req.organizerId = organizer._id;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Session expired — please log in again' });
        }
        return res.status(401).json({ success: false, message: 'Invalid organizer token' });
    }
}

async function requireEventShowAccess(req, res, next) {
    try {
        const eventId = String(req.params.eventId || '');
        if (!eventId) {
            return res.status(400).json({ success: false, message: 'Event ID required' });
        }

        const access = await organizerCanAccessEvent(req.organizer, eventId);
        if (!access.allowed || !access.eventShowId) {
            return res.status(403).json({ success: false, message: 'You do not have access to this event' });
        }

        req.eventShowId = access.eventShowId;
        next();
    } catch (error) {
        console.error('[requireEventShowAccess]', error.message);
        return res.status(500).json({ success: false, message: 'Access check failed' });
    }
}

module.exports = { authenticateEventShowOrganizer, requireEventShowAccess };
