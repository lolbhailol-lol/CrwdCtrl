const jwt = require('jsonwebtoken');
const FestOrganizerAccount = require('../model/fest_organizer_account_model');
const { getJwtSecret } = require('../config/jwtSecret');
const {
    organizerCanAccessFest,
    festRouteAllowedForOrganizer,
    isFullOrganizer,
} = require('../utils/festOrganizerAccess');
const { MINDSPARK_FEST_ID } = require('../modules/fest/plugins/mindspark');
const { enforceCompetitionScope } = require('./festCompetitionScope');

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
        req.displayName = String(decoded.displayName || '').trim();
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

        const path = String(req.path || '');
        const method = String(req.method || 'GET');
        if (!festRouteAllowedForOrganizer(req.organizer, method, path)) {
            const role = String(req.organizer.portalRole || '');
            const message = role === 'desk'
                ? 'Desk accounts can only access Fest Day Desk'
                : role === 'cohead'
                    ? 'You do not have access to this page'
                    : 'Access denied';
            return res.status(403).json({ success: false, message });
        }

        req.festId = festId;
        return enforceCompetitionScope(req, res, next);
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Access check failed' });
    }
}

/** Main organizers only — invite / manage co-heads. */
function requireAccessManager(req, res, next) {
    if (!isFullOrganizer(req.organizer)) {
        return res.status(403).json({
            success: false,
            message: 'Only main organizers can manage co-head access',
        });
    }
    next();
}

function requireMindSparkPaymentsAccess(req, res, next) {
    if (!organizerCanAccessFest(req.organizer, MINDSPARK_FEST_ID)) {
        return res.status(403).json({
            success: false,
            message: 'This login is for MindSpark payments only',
        });
    }
    next();
}

module.exports = {
    authenticateFestOrganizer,
    requireFestAccess,
    requireAccessManager,
    requireMindSparkPaymentsAccess,
};
