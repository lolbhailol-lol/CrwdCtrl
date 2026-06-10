const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const User = require('../model/usermodel');
const { getJwtSecret } = require('../config/jwtSecret');

/**
 * Allows fest check-in for:
 * - fest_scanner JWT (code + password login)
 * - organizer user JWT (owns fest)
 * - admin JWT
 */
module.exports = async function scannerAuth(req, res, next) {
  try {
    const { festId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(festId)) {
      return res.status(400).json({ success: false, message: 'Invalid fest ID' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Scanner login required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.role === 'fest_scanner') {
      if (String(decoded.festId) !== String(festId)) {
        return res.status(403).json({ success: false, message: 'Scanner login is for a different fest' });
      }
      const fest = await FestOrganizer.findById(festId).select(
        'festName collegeName registration.googleSheetsUrl scannerAccess.enabled',
      );
      if (!fest?.scannerAccess?.enabled) {
        return res.status(403).json({ success: false, message: 'Scanner access disabled for this fest' });
      }
      req.scanner = {
        type: 'fest_scanner',
        festId,
        fest,
        scannedBy: decoded.label || decoded.code || 'Volunteer',
      };
      return next();
    }

    if (decoded.role === 'admin' && decoded.type !== 'refresh') {
      const fest = await FestOrganizer.findById(festId).select(
        'festName collegeName registration.googleSheetsUrl',
      );
      if (!fest) {
        return res.status(404).json({ success: false, message: 'Fest not found' });
      }
      req.scanner = {
        type: 'admin',
        festId,
        fest,
        scannedBy: decoded.email || 'Admin',
      };
      return next();
    }

    if (decoded.userId) {
      const user = await User.findById(decoded.userId).select('name email role');
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      if (user.role === 'organizer') {
        const fest = await FestOrganizer.findOne({
          _id: festId,
          organizer: decoded.userId,
        }).select('festName collegeName registration.googleSheetsUrl');
        if (fest) {
          req.scanner = {
            type: 'organizer',
            festId,
            fest,
            scannedBy: user.name || user.email || 'Organizer',
          };
          return next();
        }
      }
    }

    return res.status(403).json({ success: false, message: 'No scanner access for this fest' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Scanner session expired — log in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid scanner session' });
  }
};
