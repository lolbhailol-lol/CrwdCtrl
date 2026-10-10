const mongoose = require('mongoose');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntEvent = require('../models/CampusHuntEvent');

/**
 * Load team by :teamId and ensure req.user belongs to it.
 * Sets req.huntTeam, req.isHuntLeader.
 */
async function requireTeamMember(req, res, next) {
  try {
    const { teamId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ success: false, message: 'Invalid team ID' });
    }
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const team = await CampusHuntTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    if (!team.includesUser(userId)) {
      return res.status(403).json({ success: false, message: 'You are not a member of this team' });
    }

    // Session bound at enter — block swapping :teamId to another team's hunt
    if (
      req.user?.huntTeamId
      && String(req.user.huntTeamId) !== String(team._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'This login is for a different team. Open your own team link.',
        code: 'WRONG_TEAM_SESSION',
      });
    }

    req.huntTeam = team;
    req.isHuntLeader = team.isLeader(userId);
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireTeamLeader(req, res, next) {
  if (!req.isHuntLeader) {
    return res.status(403).json({
      success: false,
      message: 'Only the team leader can perform this action',
      code: 'LEADER_ONLY',
    });
  }
  return next();
}

async function blockEmergencyStopped(req, res, next) {
  try {
    const eventId = req.huntTeam?.eventId || req.params.eventId;
    if (!eventId) return next();
    const event = await CampusHuntEvent.findById(eventId).select('hosted emergencyStoppedAt').lean();
    if (event?.hosted && event.emergencyStoppedAt) {
      return res.status(423).json({ success: false, message: 'This Campus Hunt is paused by CrwdCtrl safety control', code: 'EMERGENCY_STOP' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireTeamMember,
  requireTeamLeader,
  blockEmergencyStopped,
};
