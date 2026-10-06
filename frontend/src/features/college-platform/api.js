import { publicFetchJSON, resolveUrl } from '../../services/api/client';
import { userFetchJSONStrict } from '../../services/api/auth.api';

export async function listGames(params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  return publicFetchJSON(`/games${search.size ? `?${search}` : ''}`);
}

export function getGame(id) {
  return publicFetchJSON(`/games/${encodeURIComponent(id)}`);
}

export function listColleges(city = '') {
  return publicFetchJSON(`/games/colleges${city ? `?city=${encodeURIComponent(city)}` : ''}`);
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
