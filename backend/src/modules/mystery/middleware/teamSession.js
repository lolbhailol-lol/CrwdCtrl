const MysteryTeam = require('../models/MysteryTeam');
const MysteryEvent = require('../models/MysteryEvent');
const { TEAM_MODE, EVENT_STATUS } = require('../constants');

/** Mystery token ki team hi :teamId pe action le sakti hai. req.mysteryTeam / req.mysteryEvent set karta hai. */
async function requireOwnTeam(req, res, next) {
  try {
    const sessionTeamId = req.user?.mysteryTeamId;
    if (!sessionTeamId) return res.status(401).json({ error: 'Mystery session required' });
    if (req.params.teamId && String(req.params.teamId) !== String(sessionTeamId)) {
      return res.status(403).json({ error: 'Ye tumhari team nahi hai' });
    }

    const team = await MysteryTeam.findById(sessionTeamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    req.mysteryTeam = team;
    req.mysteryEvent = team.eventId ? await MysteryEvent.findById(team.eventId) : null;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Session check failed' });
  }
}

/** Practice kabhi bhi; competitive team sirf tab jab event live ho. */
function isPlayable(team, event) {
  if (team.mode === TEAM_MODE.PRACTICE) return true;
  return event?.status === EVENT_STATUS.LIVE;
}

function requirePlayable(req, res, next) {
  if (isPlayable(req.mysteryTeam, req.mysteryEvent)) return next();
  return res.status(403).json({ error: 'Event abhi live nahi hai', code: 'EVENT_NOT_LIVE' });
}

module.exports = { requireOwnTeam, requirePlayable, isPlayable };
