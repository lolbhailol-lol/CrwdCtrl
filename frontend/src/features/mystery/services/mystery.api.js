import { publicFetchJSON, resolveUrl } from '../../../services/api/client';
import { adminFetchJSON } from '../../../services/api/admin.api';
import { getApiBaseCandidates } from '../../../config/apiBase.js';
import {
  clearMysteryAuth,
  isMysteryTokenExpired,
  resolveMysteryToken,
} from '../utils/mysteryAuth';

const BASE = '/mystery';

function mysteryFetchTimeout(options = {}) {
  if (options.timeout) return options.timeout;
  const fromEnv = parseInt(import.meta.env.VITE_API_TIMEOUT, 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 30000;
}

function isNetworkError(err) {
  return err?.name === 'AbortError'
    || err?.name === 'TypeError'
    || /failed to fetch|load failed|network|timeout|networkerror/i.test(String(err?.message || ''));
}

/** Authenticated Mystery player API — uses mystery_player_token only. */
async function mysteryJson(url, options = {}) {
  let token = resolveMysteryToken();
  if (!token || isMysteryTokenExpired(token)) {
    clearMysteryAuth();
    const err = new Error('Mystery session expired — log in again');
    err.status = 401;
    err.code = 'AUTH_401';
    throw err;
  }

  const timeout = mysteryFetchTimeout(options);
  const maxRetries = options.retries ?? 3;
  const bases = getApiBaseCandidates();
  const method = String(options.method ?? 'GET').toUpperCase();
  let body = options.body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
  }

  const attempt = async (retryCount = 0, baseIndex = 0) => {
    const base = bases[Math.min(baseIndex, bases.length - 1)];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(resolveUrl(url, base), {
        ...options,
        method,
        body: body != null && method !== 'GET' ? body : undefined,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        clearMysteryAuth();
        const err = new Error(data.message || data.error || 'Mystery session expired — log in again');
        err.status = 401;
        err.code = data.code || 'AUTH_401';
        throw err;
      }
      if (!response.ok) {
        const err = new Error(data.message || data.error || 'Request failed');
        err.status = response.status;
        err.code = data.code;
        err.data = data;
        if (response.status >= 500 && retryCount < maxRetries) {
          await new Promise((r) => setTimeout(r, 800 * (retryCount + 1)));
          return attempt(retryCount + 1, baseIndex < bases.length - 1 ? baseIndex + 1 : baseIndex);
        }
        throw err;
      }
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err?.status === 401 || err?.code === 'AUTH_401') throw err;
      if (isNetworkError(err) && retryCount < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * (retryCount + 1)));
        return attempt(retryCount + 1, baseIndex < bases.length - 1 ? baseIndex + 1 : baseIndex);
      }
      if (isNetworkError(err)) {
        const netErr = new Error('Network slow — offline mode will kick in');
        netErr.code = 'NETWORK_ERROR';
        netErr.isNetworkError = true;
        throw netErr;
      }
      throw err;
    }
  };

  return attempt();
}

/* ============ PUBLIC (no login needed) ============ */
export async function fetchMysteryCases() {
  return publicFetchJSON(`${BASE}/cases`);
}
export async function fetchMysteryEvents() {
  return publicFetchJSON(`${BASE}/events`);
}
export async function fetchMysteryEventDetail(eventId) {
  return publicFetchJSON(`${BASE}/events/${eventId}`);
}
export async function registerMysteryTeam(body) {
  return publicFetchJSON(`${BASE}/teams/register`, { method: 'POST', body: JSON.stringify(body) });
}
export async function enterMysteryTeam(teamCode, password) {
  return publicFetchJSON(`${BASE}/teams/enter`, { method: 'POST', body: JSON.stringify({ teamCode, password }) });
}
export async function startMysteryPractice(body) {
  return publicFetchJSON(`${BASE}/teams/practice`, { method: 'POST', body: JSON.stringify(body) });
}
export async function fetchPublicLeaderboard(eventId) {
  return publicFetchJSON(`${BASE}/leaderboard/event/${eventId}`);
}
export async function fetchCaseLeaderboard(caseId) {
  return publicFetchJSON(`${BASE}/leaderboard/case/${caseId}`);
}

/* ============ AUTHENTICATED (mystery token) ============ */
export async function fetchMyMysteryTeam() {
  return mysteryJson(`${BASE}/teams/me`);
}
export async function startInvestigation(teamId) {
  return mysteryJson(`${BASE}/investigation/${teamId}/start`, { method: 'POST', body: JSON.stringify({}) });
}
export async function fetchInvestigationState(teamId) {
  return mysteryJson(`${BASE}/investigation/${teamId}/state`);
}
export async function unlockEvidenceByQr(teamId, qrSecret) {
  return mysteryJson(`${BASE}/investigation/${teamId}/unlock-qr`, { method: 'POST', body: JSON.stringify({ qrSecret }) });
}
export async function chooseInvestigationBranch(teamId, branchId, leadId) {
  return mysteryJson(`${BASE}/investigation/${teamId}/branch`, { method: 'POST', body: JSON.stringify({ branchId, leadId }) });
}
export async function setEvidenceTrust(teamId, evidenceId, decision) {
  return mysteryJson(`${BASE}/investigation/${teamId}/trust`, { method: 'POST', body: JSON.stringify({ evidenceId, decision }) });
}
export async function connectEvidencePair(teamId, evidenceIdA, evidenceIdB) {
  return mysteryJson(`${BASE}/investigation/${teamId}/connect`, { method: 'POST', body: JSON.stringify({ evidenceIdA, evidenceIdB }) });
}
export async function fetchPendingFightsBack(teamId) {
  return mysteryJson(`${BASE}/investigation/${teamId}/fights-back/pending`);
}
export async function acknowledgeFightsBack(teamId, eventId) {
  return mysteryJson(`${BASE}/investigation/${teamId}/fights-back/${eventId}/ack`, { method: 'POST', body: JSON.stringify({}) });
}
export async function submitFinalCase(teamId, payload) {
  return mysteryJson(`${BASE}/submissions/${teamId}`, { method: 'POST', body: JSON.stringify(payload) });
}

/* ============ ADMIN (regular CrwdCtrl admin/organizer token) ============ */
export async function adminListMysteryCases() {
  return adminFetchJSON(`${BASE}/cases`);
}
export async function adminCreateMysteryCase(body) {
  return adminFetchJSON(`${BASE}/cases`, { method: 'POST', body: JSON.stringify(body) });
}
export async function adminGetCaseDetail(caseId) {
  return adminFetchJSON(`${BASE}/cases/${caseId}/admin-detail`);
}
export async function adminAddMysteryEvidence(caseId, body) {
  return adminFetchJSON(`${BASE}/cases/${caseId}/evidence`, { method: 'POST', body: JSON.stringify(body) });
}
export async function adminAddMysteryBranch(caseId, body) {
  return adminFetchJSON(`${BASE}/cases/${caseId}/branches`, { method: 'POST', body: JSON.stringify(body) });
}
export async function adminAddFightsBack(caseId, body) {
  return adminFetchJSON(`${BASE}/cases/${caseId}/fights-back`, { method: 'POST', body: JSON.stringify(body) });
}
export async function adminPublishMysteryCase(caseId) {
  return adminFetchJSON(`${BASE}/cases/${caseId}/publish`, { method: 'POST', body: JSON.stringify({}) });
}
export async function adminListMysteryEvents() {
  return adminFetchJSON(`${BASE}/events`);
}
export async function adminCreateMysteryEvent(body) {
  return adminFetchJSON(`${BASE}/events`, { method: 'POST', body: JSON.stringify(body) });
}