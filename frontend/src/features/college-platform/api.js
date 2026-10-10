import { publicFetchJSON, resolveUrl } from '../../services/api/client';
import { userFetchJSONStrict } from '../../services/api/auth.api';
import { getBearerAuthHeaders, resolveAuthToken } from '../../utils/authToken';

const PAST_GAME_GRACE_MS = 24 * 60 * 60 * 1000;

// A published game whose day has passed is shown as completed even before an admin closes it.
function withPastGamesCompleted(game) {
  if (!game || game.status !== 'published') return game;
  const endsAt = new Date(game.endsAt || game.startsAt || 0).getTime();
  if (!endsAt || Date.now() - endsAt < PAST_GAME_GRACE_MS) return game;
  return { ...game, status: 'completed', spotsLeft: 0 };
}

export async function listGames(params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  const data = await publicFetchJSON(`/games${search.size ? `?${search}` : ''}`);
  return { ...data, games: (data?.games || []).map(withPastGamesCompleted) };
}

export async function getGame(id) {
  const data = await publicFetchJSON(`/games/${encodeURIComponent(id)}`);
  return data?.game ? { ...data, game: withPastGamesCompleted(data.game) } : data;
}

export async function listColleges(city = '') {
  const data = await publicFetchJSON(`/games/colleges${city ? `?city=${encodeURIComponent(city)}` : ''}`);
  return {
    ...data,
    colleges: (data?.colleges || []).map((college) => ({
      ...college,
      id: String(college.id || college._id || ''),
    })).filter((college) => college.id),
  };
}

export async function getRankings(params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  const data = await publicFetchJSON(`/games/rankings${search.size ? `?${search}` : ''}`);
  try {
    localStorage.setItem('crwdctrl_college_rankings_v1', JSON.stringify(data));
  } catch {
    return data;
  }
  return data;
}

export function getCachedRankings() {
  try {
    return JSON.parse(localStorage.getItem('crwdctrl_college_rankings_v1') || 'null');
  } catch {
    return null;
  }
}

export function reserveGame(gameId, payload) {
  return userFetchJSONStrict(`/games/${gameId}/reservations`, {
    method: 'POST',
    body: JSON.stringify(payload),
    cacheBust: false,
  });
}

export function myGameRegistrations() {
  return userFetchJSONStrict('/games/me/registrations', { cacheBust: false });
}

export function getGamePass(id) {
  return userFetchJSONStrict(`/games/passes/${id}`, { cacheBust: false });
}

export function requestMyGameRefund(registrationId, reason) {
  return userFetchJSONStrict(`/games/me/registrations/${registrationId}/refunds`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify({ reason }),
  });
}

export function createMyGameDispute(registrationId, reason) {
  return userFetchJSONStrict(`/games/me/registrations/${registrationId}/disputes`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify({ reason }),
  });
}

export function reportGame(gameId, type, message) {
  return userFetchJSONStrict(`/games/${gameId}/reports`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify({ type, message }),
  });
}

export function getCollegeProfile() {
  return userFetchJSONStrict('/games/me/profile', { cacheBust: false });
}

export function claimGameInvite(token) {
  return userFetchJSONStrict(`/games/invites/${encodeURIComponent(token)}/claim`, {
    method: 'POST',
    cacheBust: false,
  });
}

export function submitHostGame(payload) {
  return fetch(resolveUrl('/games/host-requests'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Could not submit your request');
    return data;
  });
}

export function submitPreRegistration(payload) {
  return fetch(resolveUrl('/games/pre-registrations'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Could not pre-register your team');
    return data;
  });
}

export function createGamePaymentOrder(gameId, registrationId) {
  return userFetchJSONStrict('/payment/order', {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify({
      gameId,
      registrationDraft: { registrationId },
    }),
  });
}

export function getCampusHostProfile() {
  return userFetchJSONStrict('/games/host/profile', { cacheBust: false });
}

export function saveCampusHostProfile(payload) {
  return userFetchJSONStrict('/games/host/profile', {
    method: 'PUT',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function listHostedCampusHunts() {
  return userFetchJSONStrict('/games/host/campus-hunts', { cacheBust: false });
}

export function createHostedCampusHunt(payload) {
  return userFetchJSONStrict('/games/host/campus-hunts', {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function updateHostedCampusHunt(gameId, payload) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}`, {
    method: 'PUT',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function deleteHostedCampusHunt(gameId) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}`, {
    method: 'DELETE',
    cacheBust: false,
  });
}

export function saveHostedHuntPermission(gameId, payload) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/permission`, {
    method: 'PUT',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function submitHostedCampusHunt(gameId) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/submit`, {
    method: 'POST',
    cacheBust: false,
  });
}

export function getHostedHuntDashboard(gameId) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/dashboard`, { cacheBust: false });
}

export function createHostedHuntControlSession(gameId) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/control-session`, {
    method: 'POST',
    cacheBust: false,
  });
}

export function getHostedHuntSetup(gameId) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/setup`, { cacheBust: false });
}

export function updateHostedHuntSetup(gameId, payload) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/setup`, {
    method: 'PATCH', cacheBust: false, body: JSON.stringify(payload),
  });
}

export function updateHostedHuntChallenge(gameId, challengeId, payload) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/setup/challenges/${challengeId}`, {
    method: 'PATCH', cacheBust: false, body: JSON.stringify(payload),
  });
}

export function createHostedHuntOperator(gameId, payload) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/operators`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function revokeHostedHuntOperator(gameId, grantId) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/operators/${grantId}`, {
    method: 'DELETE',
    cacheBust: false,
  });
}

export function runHostedHuntOperation(gameId, action, payload = {}) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/operations/${action}`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function runHostedHuntTeamOperation(gameId, teamId, action, payload) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/teams/${teamId}/${action}`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function activateHostedHuntCheckInPack(gameId, deviceId) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/check-in-pack/activate`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify({ deviceId }),
  });
}

export function syncHostedHuntCheckInPack(gameId, payload) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/check-in-pack/sync`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function sendHostedHuntAnnouncement(gameId, payload) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/announcements`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify(payload),
  });
}

export function requestHostedHuntRefund(gameId, registrationId, reason) {
  return userFetchJSONStrict(`/games/host/campus-hunts/${gameId}/registrations/${registrationId}/refunds`, {
    method: 'POST',
    cacheBust: false,
    body: JSON.stringify({ reason }),
  });
}

export async function uploadHostPermissionDocument(gameId, file) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(resolveUrl(`/games/host/campus-hunts/${gameId}/permission-document`), {
    method: 'POST',
    credentials: 'include',
    headers: getBearerAuthHeaders(resolveAuthToken()),
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Permission upload failed');
  return data;
}

export async function emergencyOperatorLogin(payload) {
  const response = await fetch(resolveUrl('/games/host-access/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Operator login failed');
  return data;
}

export async function emergencyOperatorAction(gameId, action, token) {
  const response = await fetch(resolveUrl(`/games/host-access/${gameId}/operations/${action}`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{}',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Operator action failed');
  return data;
}
