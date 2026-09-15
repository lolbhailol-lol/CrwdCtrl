const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getJwtSecret } = require('../../../config/jwtSecret');
const CampusHuntVolunteerAccess = require('../models/CampusHuntVolunteerAccess');

/**
 * Requires Bearer JWT with role campus_hunt_volunteer.
 * Sets req.huntVolunteer = { volunteerAccessId, eventId, checkpointIds, label, code }
 */
async function volunteerAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Volunteer login required' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired volunteer session' });
    }

    if (decoded.role !== 'campus_hunt_volunteer') {
      return res.status(403).json({ success: false, message: 'Volunteer access required' });
    }

    if (!mongoose.Types.ObjectId.isValid(decoded.volunteerAccessId)) {
      return res.status(401).json({ success: false, message: 'Invalid volunteer session' });
    }

    const access = await CampusHuntVolunteerAccess.findById(decoded.volunteerAccessId);
    if (!access || !access.enabled) {
      return res.status(403).json({ success: false, message: 'Volunteer access disabled' });
    }
    if (String(access.eventId) !== String(decoded.eventId)) {
      return res.status(403).json({ success: false, message: 'Volunteer session mismatch' });
    }

    req.huntVolunteer = {
      volunteerAccessId: String(access._id),
      eventId: String(access.eventId),
      checkpointIds: (access.checkpointIds || []).map(String),
      label: access.label || access.code,
      code: access.code,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireCheckpointAssignment(req, res, next) {
  const checkpointId = req.params.checkpointId;
  if (!checkpointId) {
    return res.status(400).json({ success: false, message: 'Checkpoint ID required' });
  }
  const allowed = req.huntVolunteer?.checkpointIds || [];
  // Empty list = all checkpoints for the event (event-wide volunteer)
  if (allowed.length > 0 && !allowed.includes(String(checkpointId))) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this checkpoint',
    });
  }
  return next();
}

module.exports = {
  volunteerAuth,
  requireCheckpointAssignment,
};
