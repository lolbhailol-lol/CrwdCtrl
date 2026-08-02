const jwt = require('jsonwebtoken');
const FestOrganizerAccount = require('../model/fest_organizer_account_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { organizerCanAccessFest } = require('../utils/festOrganizerAccess');

async function authenticateFestOrganizer(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Organizer token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getJwtSecret());

        if (decoded.role !== 'fest_organizer' || !decoded.organizerId) {
            return res.status(403).json({ success: false, message: 'Invalid organizer session' });
        }

        const organizer = await FestOrganizerAccount.findById(decoded.organizerId).lean();
        if (!organizer || !FestOrganizerAccount.canLogin(organizer)) {
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

async function requireFestAccess(req, res, next) {
    try {
        const festId = String(req.params.festId || '');
        if (!festId) {
            return res.status(400).json({ success: false, message: 'Fest ID required' });
        }

        if (!organizerCanAccessFest(req.organizer, festId)) {
            return res.status(403).json({ success: false, message: 'You do not have access to this fest' });
        }

        req.festId = festId;
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Access check failed' });
    }
}

module.exports = { authenticateFestOrganizer, requireFestAccess };
