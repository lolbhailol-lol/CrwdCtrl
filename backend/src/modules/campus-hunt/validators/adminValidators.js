const { EVENT_STATUSES, ISSUE_CATEGORIES } = require('../constants');

function requireFields(body, fields) {
  for (const f of fields) {
    if (body[f] == null || body[f] === '') {
      const err = new Error(`${f} is required`);
      err.status = 400;
      throw err;
    }
  }
}

function validateEventCreate(body = {}) {
  requireFields(body, ['name', 'college', 'slug']);
  if (body.status && !EVENT_STATUSES.includes(body.status)) {
    const err = new Error('Invalid event status');
    err.status = 400;
    throw err;
  }
  return {
    name: String(body.name).trim(),
    college: String(body.college).trim(),
    slug: String(body.slug).trim().toLowerCase(),
    date: body.date ? new Date(body.date) : undefined,
    status: body.status || 'draft',
    teamCapacity: body.teamCapacity != null ? Number(body.teamCapacity) : 40,
    teamSize: body.teamSize != null ? Number(body.teamSize) : 4,
    startingScore: body.startingScore != null ? Number(body.startingScore) : 100,
    publicLeaderboardLive: body.publicLeaderboardLive === true,
    featureNotes: body.featureNotes || '',
    scoringConfig: body.scoringConfig,
  };
}

function validateTeamCreate(body = {}) {
  requireFields(body, ['teamCode', 'teamName', 'leaderUserId']);
  const { assertValidTeamRoster } = require('../utils/roster');
  const teamSize = body.teamSize != null ? Number(body.teamSize) : 4;
  const roster = assertValidTeamRoster({
    leaderUserId: body.leaderUserId,
    memberUserIds: Array.isArray(body.memberUserIds) ? body.memberUserIds : [],
    teamSize,
  });
  return {
    teamCode: String(body.teamCode).trim().toUpperCase(),
    teamName: String(body.teamName).trim(),
    leaderUserId: roster.leaderUserId,
    memberUserIds: roster.memberUserIds,
    routeId: body.routeId,
    roundId: body.roundId,
  };
}

function validateIssueBody(body = {}) {
  requireFields(body, ['category']);
  if (!ISSUE_CATEGORIES.includes(body.category)) {
    const err = new Error('Invalid issue category');
    err.status = 400;
    throw err;
  }
  return {
    category: body.category,
    notes: body.notes ? String(body.notes).slice(0, 2000) : '',
    teamId: body.teamId,
    checkpointId: body.checkpointId,
  };
}

function validateStartingPoint(body = {}, { partial = false } = {}) {
  if (!partial) requireFields(body, ['name', 'code']);
  const output = {};
  if (body.roundId != null && body.roundId !== '') output.roundId = body.roundId;
  if (body.name != null) output.name = String(body.name).trim();
  if (body.code != null) output.code = String(body.code).trim().toUpperCase();
  if (body.description != null) output.description = String(body.description).trim();
  if (body.capacity != null) {
    const capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      const err = new Error('capacity must be a positive integer');
      err.status = 400;
      throw err;
    }
    output.capacity = capacity;
  }
  if (body.displayOrder != null) output.displayOrder = Number(body.displayOrder) || 0;
  if (body.active != null) output.active = body.active === true;
  return output;
}

function validateStartSchedule(body = {}) {
  requireFields(body, ['roundId']);
  if (body.releaseIntervalMinutes != null) {
    const interval = Number(body.releaseIntervalMinutes);
    if (!Number.isInteger(interval) || interval < 1) {
      const err = new Error('releaseIntervalMinutes must be a positive integer');
      err.status = 400;
      throw err;
    }
  }
  if (
    body.assignmentStrategy
    && !['sequential', 'route_balanced'].includes(body.assignmentStrategy)
  ) {
    const err = new Error('Invalid assignmentStrategy');
    err.status = 400;
    throw err;
  }
  return {
    roundId: body.roundId,
    startsAt: body.startsAt,
    releaseIntervalMinutes: body.releaseIntervalMinutes,
    assignmentStrategy: body.assignmentStrategy,
    confirm: body.confirm === true,
    reason: body.reason ? String(body.reason).trim() : '',
  };
}

module.exports = {
  requireFields,
  validateEventCreate,
  validateTeamCreate,
  validateIssueBody,
  validateStartingPoint,
  validateStartSchedule,
};
