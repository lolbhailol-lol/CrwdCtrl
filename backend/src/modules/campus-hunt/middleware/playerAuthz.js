const mongoose = require('mongoose');
const CampusHuntTeam = require('../models/CampusHuntTeam');

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

module.exports = {
  requireTeamMember,
  requireTeamLeader,
};
