const jwt = require('jsonwebtoken');
const TrekOrganizerAccount = require('../model/trek_organizer_account_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { organizerCanAccessTrek } = require('../utils/trekOrganizerAccess');

async function authenticateTrekOrganizer(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Organizer token required' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getJwtSecret());

        if (decoded.role !== 'trek_organizer' || !decoded.organizerId) {
            return res.status(403).json({ success: false, message: 'Invalid organizer session' });
        }

        const organizer = await TrekOrganizerAccount.findById(decoded.organizerId).lean();
        if (!organizer || !organizer.isActive) {
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

async function requireTrekAccess(req, res, next) {
    try {
        const trekId = String(req.params.trekId || '');
        if (!trekId) {
            return res.status(400).json({ success: false, message: 'Trek ID required' });
        }

        const allowed = await organizerCanAccessTrek(req.organizer, trekId);
        if (!allowed) {
            return res.status(403).json({ success: false, message: 'You do not have access to this trek' });
        }

        req.trekId = trekId;
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Access check failed' });
    }
}

module.exports = { authenticateTrekOrganizer, requireTrekAccess };
