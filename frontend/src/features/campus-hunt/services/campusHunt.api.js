import { userApiCall } from '../../../services/api/auth.api';
import { adminFetchJSON } from '../../../services/api/admin.api';
import { publicFetchJSON, resolveUrl } from '../../../services/api/client';
import { gridClientHeaders } from '../grid/laptopOnly';

const BASE = '/campus-hunt';

function withGridClientHeaders(options = {}) {
  return {
    ...options,
    headers: {
      ...gridClientHeaders(),
      ...(options.headers || {}),
    },
  };
}
async function userJson(url, options = {}) {
  const response = await userApiCall(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.message || data.error || 'Request failed');
    err.status = response.status;
    err.code = data.code;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchCampusHuntStatus() {
  return publicFetchJSON(`${BASE}/status`);
}

export async function fetchEventBySlug(slug) {
  return publicFetchJSON(`${BASE}/events/by-slug/${encodeURIComponent(slug)}`);
}

/** Public team shell (code + name only — no roster / emails / stage) */
export async function fetchTeamLoginCard(slug, teamCode) {
  return publicFetchJSON(
    `${BASE}/events/by-slug/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamCode)}`,
  );
}

/** After password — reveal teammate names for tapping (no emails) */
export async function unlockTeamRoster(slug, teamCode, password) {
  return publicFetchJSON(
    `${BASE}/events/by-slug/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamCode)}/unlock`,
    {
      method: 'POST',
      body: JSON.stringify({ password }),
    },
  );
}

export async function loginTeamMember(slug, teamCode, email, password) {
  const response = await publicFetchJSON(
    `${BASE}/events/by-slug/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamCode)}/login`,
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
  return {
    success: true,
    isAdmin: false,
    user: response.data.user,
    token: response.data.token,
  };
}

/** Team code + shared password + who you are (leader / player slot). */
export async function enterTeamAsMember(slug, teamCode, { password, role, slot }) {
  const response = await publicFetchJSON(
    `${BASE}/events/by-slug/${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamCode)}/enter`,
    {
      method: 'POST',
      body: JSON.stringify({ password, role, slot }),
    },
  );
  return {
    success: true,
    isAdmin: false,
    user: response.data?.user || response.user,
    token: response.data?.token || response.token,
    team: response.data?.team,
  };
}

export async function fetchMyTeam(eventId) {
  return userJson(`${BASE}/me/team?eventId=${encodeURIComponent(eventId)}`);
}

export async function fetchTeamProgress(teamId) {
  return userJson(`${BASE}/teams/${teamId}/progress`);
}

export async function submitChallengeAnswer(teamId, challengeNumber, answer, requestId) {
  const path =
    Number(challengeNumber) === 1
      ? `${BASE}/teams/${teamId}/challenges/1/submit`
      : `${BASE}/teams/${teamId}/challenges/${challengeNumber}/submit`;
  return userJson(path, {
    method: 'POST',
    body: JSON.stringify({ answer, requestId }),
  });
}

export async function requestChallengeHint(teamId, challengeNumber, requestId) {
  return userJson(`${BASE}/teams/${teamId}/challenges/${challengeNumber}/hint`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true, requestId }),
  });
}

export async function scanStationCheckpoint(teamId, raw) {
  return userJson(`${BASE}/teams/${teamId}/checkpoints/scan`, {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
}

/** After 4/4 shared-station scans — confirm team code to unlock allotted clue. */
export async function confirmStationCheckpoint(teamId, { teamCode, checkpointId }) {
  return userJson(`${BASE}/teams/${teamId}/checkpoints/confirm`, {
    method: 'POST',
    body: JSON.stringify({ teamCode, checkpointId }),
  });
}

/** Local/dev only — requires 4 distinct roster members. Not available in production. */
export async function forceUnlockClue2(teamId) {
  if (!import.meta.env.DEV) {
    throw new Error('Dev unlock is not available');
  }
  return userJson(`${BASE}/teams/${teamId}/dev/force-clue2`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchLeaderboard(eventId) {
  return userJson(`${BASE}/events/${eventId}/leaderboard`);
}

/** Public colleges + events for profile picker */
export async function fetchCampusHuntColleges() {
  return publicFetchJSON(`${BASE}/colleges`);
}

/** Profile sidebar: which Campus Hunt login / leaderboard entries are live */
export async function fetchCampusHuntProfileEntries() {
  return publicFetchJSON(`${BASE}/profile-entries`);
}

/** Public live leaderboard (no login required) */
export async function fetchPublicLeaderboard(eventId) {
  return publicFetchJSON(`${BASE}/events/${encodeURIComponent(eventId)}/leaderboard/public`);
}

export async function fetchPublicFinaleLeaderboard(eventId) {
  return publicFetchJSON(`${BASE}/events/${encodeURIComponent(eventId)}/finale/leaderboard`);
}

export async function fetchFinaleMe(eventId) {
  return userJson(`${BASE}/events/${encodeURIComponent(eventId)}/finale/me`);
}

export async function startFinaleMission(teamId, missionId) {
  return userJson(`${BASE}/teams/${teamId}/finale/missions/${encodeURIComponent(missionId)}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function submitFinaleMission(teamId, missionId, answer) {
  return userJson(`${BASE}/teams/${teamId}/finale/missions/${encodeURIComponent(missionId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

export async function abandonFinaleMission(teamId) {
  return userJson(`${BASE}/teams/${teamId}/finale/missions/abandon`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function stopFinaleTeam(teamId) {
  return userJson(`${BASE}/teams/${teamId}/finale/stop`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function joinGridGame(accessCode) {
  return publicFetchJSON(`${BASE}/grid/join`, withGridClientHeaders({
    method: 'POST',
    body: JSON.stringify({ accessCode }),
  }));
}

export async function fetchGridSession(sessionToken) {
  return publicFetchJSON(
    `${BASE}/grid/session/${encodeURIComponent(sessionToken)}`,
    withGridClientHeaders(),
  );
}

export async function submitGridLevel(sessionToken, path) {
  return publicFetchJSON(
    `${BASE}/grid/session/${encodeURIComponent(sessionToken)}/submit`,
    withGridClientHeaders({
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  );
}

export async function timeoutGridLevel(sessionToken) {
  return publicFetchJSON(
    `${BASE}/grid/session/${encodeURIComponent(sessionToken)}/timeout`,
    withGridClientHeaders({
      method: 'POST',
      body: JSON.stringify({}),
    }),
  );
}

export async function useGridHint(sessionToken, path = []) {
  return publicFetchJSON(
    `${BASE}/grid/session/${encodeURIComponent(sessionToken)}/hint`,
    withGridClientHeaders({
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  );
}

/* Volunteer */
const VOL_SESSION_KEY = 'campus_hunt_volunteer_session';

export function saveVolunteerSession(session) {
  sessionStorage.setItem(VOL_SESSION_KEY, JSON.stringify(session));
}

export function getVolunteerSession() {
  try {
    const raw = sessionStorage.getItem(VOL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearVolunteerSession() {
  sessionStorage.removeItem(VOL_SESSION_KEY);
}

async function volunteerFetch(path, { method = 'GET', body, token } = {}) {
  const session = getVolunteerSession();
  const auth = token || session?.token;
  const res = await fetch(resolveUrl(`${BASE}/volunteer${path}`), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Volunteer request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function volunteerLogin({ eventId, code, password }) {
  const data = await volunteerFetch('/login', {
    method: 'POST',
    body: { eventId, code, password },
  });
  if (data?.data?.token) {
    saveVolunteerSession({
      token: data.data.token,
      volunteer: data.data.volunteer,
    });
  }
  return data;
}

export async function volunteerMe() {
  return volunteerFetch('/me');
}

export async function volunteerScanTeam(checkpointId, teamCode) {
  return volunteerFetch(`/checkpoints/${checkpointId}/scan`, {
    method: 'POST',
    body: { teamCode },
  });
}

export async function volunteerVerifyMember(checkpointId, { teamId, userId }) {
  return volunteerFetch(`/checkpoints/${checkpointId}/verify-member`, {
    method: 'POST',
    body: { teamId, userId },
  });
}

export async function volunteerComplete(checkpointId, teamId, reason) {
  return volunteerFetch(`/checkpoints/${checkpointId}/complete`, {
    method: 'POST',
    body: { teamId, reason },
  });
}

export async function volunteerReportIssue(payload) {
  return volunteerFetch('/issues', { method: 'POST', body: payload });
}

/* Admin */
export async function adminListEvents() {
  return adminFetchJSON(`${BASE}/admin/events`);
}

export async function adminCreateEvent(body) {
  return adminFetchJSON(`${BASE}/admin/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminUpdateEvent(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function adminDeleteEvent(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function adminGetOverview(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/overview`);
}

export async function adminUpdateCampusStations(eventId, campusStations, reason = '') {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/campus-stations`, {
    method: 'PATCH',
    body: JSON.stringify({ campusStations, reason }),
  });
}

export async function adminBootstrapRound1(eventId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/bootstrap-round1`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminCreateRound(eventId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/rounds`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminLiveTeams(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/live-teams`);
}

export async function adminLeaderboard(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/leaderboard`);
}

export async function adminCheckpointMonitor(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/checkpoint-monitor`);
}

export async function adminChallengeMonitor(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/challenge-monitor`);
}

export async function adminListIssues(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/issues`);
}

export async function adminListAudit(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/audit`);
}

export async function adminStartRound(roundId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/rounds/${roundId}/start`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminLockRound(roundId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/rounds/${roundId}/lock`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminReopenRound(roundId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/rounds/${roundId}/reopen`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminFinalizeLeaderboard(roundId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/rounds/${roundId}/finalize-leaderboard`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminCreateTeam(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/teams`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminUpdateTeam(teamId, body) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function adminDeleteTeam(teamId) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}`, {
    method: 'DELETE',
  });
}

export async function adminBulkCreateTeams(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/teams/bulk`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminListTeams(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/teams`);
}

export async function adminGetTeam(teamId) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}`);
}

export async function adminListStartingPoints(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/starting-points`);
}

export async function adminCreateStartingPoint(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/starting-points`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminUpdateStartingPoint(startingPointId, body) {
  return adminFetchJSON(`${BASE}/admin/starting-points/${startingPointId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function adminDeleteStartingPoint(startingPointId) {
  return adminFetchJSON(`${BASE}/admin/starting-points/${startingPointId}`, {
    method: 'DELETE',
  });
}

export async function adminPreviewStartSchedule(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/start-schedule/preview`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminGenerateStartSchedule(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/start-schedule/generate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminLockStartSchedule(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/start-schedule/lock`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminResyncClue1(eventId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/resync-clue1`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminBulkSaveClue2(eventId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/clue2/bulk-save`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminBulkSaveClue1(eventId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/clue1/bulk-save`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminBulkSaveClue3(eventId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/clue3/bulk-save`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminGetStartDashboard(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/start-dashboard`);
}

export async function adminSetRoundReleasesPaused(roundId, paused, body = {}) {
  return adminFetchJSON(`${BASE}/admin/rounds/${roundId}/releases/${paused ? 'pause' : 'resume'}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminSetStartingPointPaused(startingPointId, paused, body = {}) {
  return adminFetchJSON(
    `${BASE}/admin/starting-points/${startingPointId}/${paused ? 'pause' : 'resume'}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function adminReleaseTeam(teamId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/release`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Organizer marks team reached at their start after Clue 4 → score locked. */
export async function adminMarkTeamStartReached(teamId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/mark-start-reached`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminRevealTeamAccess(teamId) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/reveal-access`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Admin reveal from team manager' }),
  });
}

export async function adminSetTeamPassword(teamId, password, reason) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/team-password`, {
    method: 'POST',
    body: JSON.stringify({
      password,
      reason: reason || 'Admin set shared team password',
    }),
  });
}

export async function adminSetAllTeamPasswords(eventId, password, reason) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/teams/set-password`, {
    method: 'POST',
    body: JSON.stringify({
      password,
      reason: reason || 'Admin set shared password for all teams',
    }),
  });
}

export async function adminManualVerifyCheckpoint(teamId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/manual-verify-checkpoint`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminPlaytestCompleteScan(teamId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/playtest-complete-scan`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminPlaytestResetTeam(teamId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/playtest-reset`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminListRoutes(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/routes`);
}

export async function adminListChallenges(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/challenges`);
}

export async function adminUpsertChallenge(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/challenges`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminListCheckpoints(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/checkpoints`);
}

export async function adminListVolunteers(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/volunteers`);
}

export async function adminCreateVolunteer(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/volunteers`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminUpsertCheckpoint(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/checkpoints`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminCreateRoute(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/routes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminUpdateRoute(routeId, body) {
  return adminFetchJSON(`${BASE}/admin/routes/${routeId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function adminAutoAssignRoutes(eventId, rebalance = false) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/routes/auto-assign`, {
    method: 'POST',
    body: JSON.stringify({ rebalance }),
  });
}

export async function adminUpdateIssue(issueId, body) {
  return adminFetchJSON(`${BASE}/admin/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function adminSetCheckpointActive(checkpointId, active, body = {}) {
  return adminFetchJSON(
    `${BASE}/admin/checkpoints/${checkpointId}/${active ? 'enable' : 'disable'}`,
    {
      method: 'POST',
      body: JSON.stringify({ ...body, active }),
    },
  );
}

export async function adminRotateCheckpointQr(checkpointId, reason) {
  return adminFetchJSON(`${BASE}/admin/checkpoints/${checkpointId}/rotate-qr`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true, reason }),
  });
}

export async function adminUpdateCheckpoint(checkpointId, body) {
  return adminFetchJSON(`${BASE}/admin/checkpoints/${checkpointId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Station QR payloads + short paste codes (ops / production camera fallback) */
export async function adminListStationQr(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/station-qr`);
}

export async function adminApplyPenalty(teamId, body) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/penalty`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminRemovePenalty(teamId, body = {}) {
  return adminFetchJSON(`${BASE}/admin/teams/${teamId}/remove-penalty`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminReconcileManual(body) {
  return adminFetchJSON(`${BASE}/admin/verifications/reconcile-manual`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminBootstrapFinale(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/bootstrap`, { method: 'POST' });
}

export async function adminGetFinaleConfig(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/config`);
}

export async function adminPatchFinaleConfig(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/config`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function adminPromoteFinaleAuto(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/promote/auto`, { method: 'POST' });
}

export async function adminPromoteFinaleManual(eventId, teamIds) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/promote/manual`, {
    method: 'POST',
    body: JSON.stringify({ teamIds }),
  });
}

export async function adminGetFinaleEntries(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/entries`);
}

export async function adminGetFinaleCandidates(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/candidates`);
}

export async function adminGetFinaleLeaderboard(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/leaderboard`);
}

export async function adminStartFinaleRound(roundId) {
  return adminFetchJSON(`${BASE}/admin/rounds/${roundId}/finale/start`, { method: 'POST' });
}

export async function adminLockFinaleRound(roundId) {
  return adminFetchJSON(`${BASE}/admin/rounds/${roundId}/finale/lock`, { method: 'POST' });
}

export async function adminStartFinaleMission(teamId, missionId) {
  return adminFetchJSON(
    `${BASE}/teams/${teamId}/finale/missions/${encodeURIComponent(missionId)}/start`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function adminGetFinaleGridSessions(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/grid-sessions`);
}

export async function adminPromoteFinaleDemo(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/promote/demo`, { method: 'POST' });
}

export async function adminGetFinaleMissionAssignments(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/mission-assignments`);
}

export async function adminPreviewFinaleSchedule(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/schedule/preview`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminGenerateFinaleSchedule(eventId, body) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/schedule/generate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminLockFinaleSchedule(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/schedule/lock`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function adminGetFinaleLiveDashboard(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/live-dashboard`);
}

export async function adminSyncFinaleReleases(eventId) {
  return adminFetchJSON(`${BASE}/admin/events/${eventId}/finale/releases/sync`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function adminSetFinaleReleasesPaused(eventId, paused) {
  return adminFetchJSON(
    `${BASE}/admin/events/${eventId}/finale/releases/${paused ? 'pause' : 'resume'}`,
    {
      method: 'POST',
      body: JSON.stringify({ paused }),
    },
  );
}

export async function adminSetFinaleMeetPaused(eventId, meetCode, paused) {
  return adminFetchJSON(
    `${BASE}/admin/events/${eventId}/finale/meet/${encodeURIComponent(meetCode)}/${paused ? 'pause' : 'resume'}`,
    {
      method: 'POST',
      body: JSON.stringify({ paused }),
    },
  );
}

export async function adminReleaseFinaleTeam(eventId, teamId) {
  return adminFetchJSON(
    `${BASE}/admin/events/${eventId}/finale/teams/${teamId}/release`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function adminStopFinaleTeam(eventId, teamId) {
  return adminFetchJSON(
    `${BASE}/admin/events/${eventId}/finale/teams/${teamId}/stop`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function adminResumeFinaleTeam(eventId, teamId) {
  return adminFetchJSON(
    `${BASE}/admin/events/${eventId}/finale/teams/${teamId}/resume`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function adminPlaytestCompleteFinaleMission(eventId, teamId, missionId) {
  return adminFetchJSON(
    `${BASE}/admin/events/${eventId}/finale/teams/${teamId}/playtest-complete-mission`,
    {
      method: 'POST',
      body: JSON.stringify({ missionId }),
    },
  );
}

export async function adminPlaytestResetFinaleTeam(eventId, teamId) {
  return adminFetchJSON(
    `${BASE}/admin/events/${eventId}/finale/teams/${teamId}/playtest-reset`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function adminFinalizeFinaleLeaderboard(roundId, confirmLock = false) {
  return adminFetchJSON(`${BASE}/admin/rounds/${roundId}/finale/finalize-leaderboard`, {
    method: 'POST',
    body: JSON.stringify({ confirmLock }),
  });
}

export async function adminLookupUser(email) {
  return adminFetchJSON(`${BASE}/admin/users/lookup?email=${encodeURIComponent(email)}`);
}

export async function volunteerScanRaw(checkpointId, raw) {
  return volunteerFetch(`/checkpoints/${checkpointId}/scan`, {
    method: 'POST',
    body: { raw },
  });
}
