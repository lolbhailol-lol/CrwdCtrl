const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Trek = require('../model/trek_model');
const { getJwtSecret } = require('../config/jwtSecret');

/**
 * Allows trek check-in for trek_scanner JWT or admin JWT.
 */
module.exports = async function trekScannerAuth(req, res, next) {
  try {
    const { trekId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(trekId)) {
      return res.status(400).json({ success: false, message: 'Invalid trek ID' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Scanner login required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.role === 'trek_scanner') {
      if (String(decoded.trekId) !== String(trekId)) {
        return res.status(403).json({ success: false, message: 'Scanner login is for a different trek' });
      }
      const trek = await Trek.findById(trekId).select(
        'trekName city registration.googleSheetsUrl scannerAccess.enabled',
      );
      if (!trek?.scannerAccess?.enabled) {
        return res.status(403).json({ success: false, message: 'Scanner access disabled for this trek' });
      }
      req.scanner = {
        type: 'trek_scanner',
        trekId,
        trek,
        scannedBy: decoded.label || decoded.code || 'Trek volunteer',
      };
      return next();
    }

    if (decoded.role === 'admin' && decoded.type !== 'refresh') {
      const trek = await Trek.findById(trekId).select(
        'trekName city registration.googleSheetsUrl',
      );
      if (!trek) {
        return res.status(404).json({ success: false, message: 'Trek not found' });
      }
      req.scanner = {
        type: 'admin',
        trekId,
        trek,
        scannedBy: decoded.email || 'Admin',
      };
      return next();
    }

    return res.status(403).json({ success: false, message: 'No scanner access for this trek' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Scanner session expired — log in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid scanner session' });
  }
};
