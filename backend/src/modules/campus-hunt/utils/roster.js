/**
 * Team roster integrity helpers for Campus Hunt anti-cheat.
 */

function uniqueIdStrings(ids = []) {
  return [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
}

/**
 * Normalize leader + members into a unique roster.
 * Throws { status, code, message } on invalid shape.
 */
function assertValidTeamRoster({ leaderUserId, memberUserIds = [], teamSize = 4 } = {}) {
  if (!leaderUserId) {
    const err = new Error('leaderUserId is required');
    err.status = 400;
    err.code = 'ROSTER_INVALID';
    throw err;
  }

  const leader = String(leaderUserId);
  const members = (memberUserIds || []).map(String);
  const requiredMembers = Math.max(0, Number(teamSize) - 1);

  if (members.length !== requiredMembers) {
    const err = new Error(`Team must have exactly ${requiredMembers} members besides the leader`);
    err.status = 400;
    err.code = 'ROSTER_SIZE';
    throw err;
  }

  if (members.some((id) => id === leader)) {
    const err = new Error('Leader cannot also be listed as a member');
    err.status = 400;
    err.code = 'ROSTER_DUPLICATE';
    throw err;
  }

  const uniqueMembers = uniqueIdStrings(members);
  if (uniqueMembers.length !== members.length) {
    const err = new Error('Duplicate member user IDs are not allowed');
    err.status = 400;
    err.code = 'ROSTER_DUPLICATE';
    throw err;
  }

  const all = uniqueIdStrings([leader, ...uniqueMembers]);
  if (all.length !== Number(teamSize)) {
    const err = new Error(`Team must have ${teamSize} distinct users`);
    err.status = 400;
    err.code = 'ROSTER_DUPLICATE';
    throw err;
  }

  return {
    leaderUserId: leader,
    memberUserIds: uniqueMembers,
    allMemberIds: all,
  };
}

function uniqueRosterFromTeam(team) {
  return uniqueIdStrings([
    team?.leaderUserId,
    ...(team?.memberUserIds || []),
  ]);
}

function assertOnlineRosterReady(team, required = 4) {
  const unique = uniqueRosterFromTeam(team);
  if (unique.length < required) {
    const err = new Error(
      `Team must have ${required} distinct members before checkpoint scans count`,
    );
    err.status = 409;
    err.code = 'ROSTER_INCOMPLETE';
    throw err;
  }
  return unique;
}

/** True when verified IDs include 4 distinct roster members. */
function hasDistinctVerifiedRoster(verifiedIds, rosterIds, required = 4) {
  const roster = new Set((rosterIds || []).map(String));
  const verified = uniqueIdStrings(verifiedIds).filter((id) => roster.has(id));
  return verified.length >= required;
}

/** True when team has 4 provisioned hunt accounts (leader + 3 scanners with login emails). */
function isTeamRosterReady(team) {
  return Boolean(
    team?.leaderUserId
    && Array.isArray(team.memberUserIds)
    && team.memberUserIds.length === 3
    && team.accessPack?.leader?.loginEmail
    && Array.isArray(team.accessPack?.scanners)
    && team.accessPack.scanners.length === 3,
  );
}

module.exports = {
  uniqueIdStrings,
  assertValidTeamRoster,
  uniqueRosterFromTeam,
  assertOnlineRosterReady,
  hasDistinctVerifiedRoster,
  isTeamRosterReady,
};
