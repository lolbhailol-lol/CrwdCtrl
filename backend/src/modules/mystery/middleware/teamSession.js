const MysteryTeam = require('../models/MysteryTeam');
const MysteryEvent = require('../models/MysteryEvent');
const { TEAM_MODE, EVENT_STATUS } = require('../constants');

/** Only the Mystery token's own team can act on :teamId. Sets req.mysteryTeam / req.mysteryEvent. */
async function requireOwnTeam(req, res, next) {
  try {
    const sessionTeamId = req.user?.mysteryTeamId;
    if (!sessionTeamId) return res.status(401).json({ error: 'Mystery session required' });
    if (req.params.teamId && String(req.params.teamId) !== String(sessionTeamId)) {
      return res.status(403).json({ error: 'This is not your team' });
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

/** Practice is always playable; competitive teams only while the event is live. */
function isPlayable(team, event) {
  if (team.mode === TEAM_MODE.PRACTICE) return true;
  return event?.status === EVENT_STATUS.LIVE;
}

function requirePlayable(req, res, next) {
  if (isPlayable(req.mysteryTeam, req.mysteryEvent)) return next();
  return res.status(403).json({ error: 'The event is not live yet', code: 'EVENT_NOT_LIVE' });
}

module.exports = { requireOwnTeam, requirePlayable, isPlayable };
