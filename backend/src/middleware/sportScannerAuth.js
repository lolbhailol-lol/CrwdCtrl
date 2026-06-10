const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const SportsEvent = require('../model/sports_model');
const { getJwtSecret } = require('../config/jwtSecret');

/**
 * Allows sports event check-in for sport_scanner JWT or admin JWT.
 */
module.exports = async function sportScannerAuth(req, res, next) {
  try {
    const { sportEventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sportEventId)) {
      return res.status(400).json({ success: false, message: 'Invalid sports event ID' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Scanner login required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.role === 'sport_scanner') {
      if (String(decoded.sportEventId) !== String(sportEventId)) {
        return res.status(403).json({ success: false, message: 'Scanner login is for a different sports event' });
      }
      const event = await SportsEvent.findById(sportEventId).select(
        'title city sportType registration.googleSheetsUrl scannerAccess.enabled',
      );
      if (!event?.scannerAccess?.enabled) {
        return res.status(403).json({ success: false, message: 'Scanner access disabled for this event' });
      }
      req.scanner = {
        type: 'sport_scanner',
        sportEventId,
        sportEvent: event,
        scannedBy: decoded.label || decoded.code || 'Sports volunteer',
      };
      return next();
    }

    if (decoded.role === 'admin' && decoded.type !== 'refresh') {
      const event = await SportsEvent.findById(sportEventId).select(
        'title city sportType registration.googleSheetsUrl',
      );
      if (!event) {
        return res.status(404).json({ success: false, message: 'Sports event not found' });
      }
      req.scanner = {
        type: 'admin',
        sportEventId,
        sportEvent: event,
        scannedBy: decoded.email || 'Admin',
      };
      return next();
    }

    return res.status(403).json({ success: false, message: 'No scanner access for this sports event' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Scanner session expired — log in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid scanner session' });
  }
};
