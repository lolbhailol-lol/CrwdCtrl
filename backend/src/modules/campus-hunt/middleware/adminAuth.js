const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../../../config/jwtSecret');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntIssueReport = require('../models/CampusHuntIssueReport');
const { CollegeGame } = require('../../college-platform/models');

const HOST_FORBIDDEN = [
  /^\/events\/?$/,
  /\/users\/lookup/,
  /\/reveal-access/,
  /\/team-password/,
  /\/teams\/set-password/,
  /\/transfer-leader/,
  /\/playtest-/,
  /\/prune-excess/,
  /\/verifications\//,
  /\/finale\//,
  /\/rounds\/[^/]+\/(?:start|lock|reopen|finalize-leaderboard)/,
  /\/rounds\/[^/]+\/releases\/(?:pause|resume)/,
];

async function resourceEventId(params) {
  if (params.eventId) return String(params.eventId);
  const lookups = [
    ['roundId', CampusHuntRound],
    ['routeId', CampusHuntRoute],
    ['teamId', CampusHuntTeam],
    ['startingPointId', CampusHuntStartingPoint],
    ['challengeId', CampusHuntChallenge],
    ['checkpointId', CampusHuntCheckpoint],
    ['issueId', CampusHuntIssueReport],
  ];
  for (const [key, Model] of lookups) {
    if (!params[key]) continue;
    // eslint-disable-next-line no-await-in-loop
    const row = await Model.findById(params[key]).select('eventId').lean();
    return row?.eventId ? String(row.eventId) : '';
  }
  return '';
}

async function authorizeHost(req, res, decoded) {
  const path = String(req.path || '');
  const createsTeam = req.method === 'POST' && /^\/events\/[^/]+\/teams(?:\/bulk)?$/.test(path);
  const editsTeam = req.method === 'PATCH' && /^\/teams\/[^/]+$/.test(path);
  if (req.method === 'DELETE' || createsTeam || editsTeam || HOST_FORBIDDEN.some((pattern) => pattern.test(path))) {
    return res.status(403).json({ error: 'Forbidden: This control stays with CrwdCtrl admin' });
  }
  const eventId = await resourceEventId(req.params || {});
  if (!eventId || eventId !== String(decoded.eventId || '')) {
    return res.status(403).json({ error: 'Forbidden: Hunt access is limited to your event' });
  }
  const game = await CollegeGame.findOne({ _id: decoded.gameId, 'engine.eventId': eventId })
    .populate('ownerHostProfileId', 'userId status phoneVerifiedAt verifiedUntil')
    .select('ownerHostProfileId')
    .lean();
  const profile = game?.ownerHostProfileId;
  const verified = profile
    && String(profile.userId) === String(decoded.userId)
    && profile.status === 'approved'
    && profile.phoneVerifiedAt
    && new Date(profile.verifiedUntil).getTime() > Date.now();
  if (!verified) return res.status(403).json({ error: 'Forbidden: Host approval is missing or expired' });
  req.user = decoded;
  return null;
}

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized: Missing token' });
    const decoded = jwt.verify(header.slice(7), getJwtSecret());
    if (decoded.type === 'refresh' || !['admin', 'campus_hunt_admin', 'campus_hunt_host'].includes(decoded.role)) {
      return res.status(403).json({ error: 'Forbidden: Campus Hunt access required' });
    }
    if (decoded.role === 'campus_hunt_host') {
      const denied = await authorizeHost(req, res, decoded);
      if (denied) return denied;
    } else req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
