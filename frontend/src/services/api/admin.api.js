/**
 * Admin API — token refresh, authenticated fetch for admin panel.
 */
import { API_BASE_URL, resolveUrl } from './client.js';
import { getApiBaseCandidates } from '../../config/apiBase.js';

export { API_BASE_URL };

export function isAdminTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    return Date.now() >= payload.exp * 1000 - 5 * 60 * 1000;
  } catch {
    return true;
  }
}

let refreshPromise = null;

function isJsonResponse(response) {
  const ct = response.headers.get('content-type') || '';
  return ct.includes('application/json');
}

async function fetchAcrossBases(path, buildOptions) {
  const bases = getApiBaseCandidates();
  let lastError = null;

  for (let i = 0; i < bases.length; i += 1) {
    const url = resolveUrl(path, bases[i]);
    try {
      const response = await fetch(url, buildOptions());
      // SPA HTML shell (missing /api rewrite) → try next base
      if (response.ok && !isJsonResponse(response) && i < bases.length - 1) {
        lastError = new Error('Non-JSON API response');
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (i < bases.length - 1) continue;
      throw err;
    }
  }

  throw lastError || new Error('Admin request failed');
}

async function refreshAdminToken() {
  const refreshToken = localStorage.getItem('admin_refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetchAcrossBases('/admin/refresh-token', () => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }));
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Token refresh failed');
      }
      if (!isJsonResponse(response)) {
        throw new Error('Token refresh failed — API unavailable');
      }
      const data = await response.json();
      localStorage.setItem('admin_token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('admin_refresh_token', data.refreshToken);
      }
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function clearAdminSession() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_refresh_token');
}

function redirectToAdminLogin() {
  clearAdminSession();
  if (!window.location.pathname.startsWith('/admin/login')) {
    window.location.href = '/admin/login';
  }
}

export async function getAdminToken({ redirectOnFail = true } = {}) {
  let token = localStorage.getItem('admin_token');

  if (!token || isAdminTokenExpired(token)) {
    try {
      token = await refreshAdminToken();
    } catch {
      if (redirectOnFail) redirectToAdminLogin();
      return null;
    }
  }
  return token;
}

export async function adminFetch(path, options = {}) {
  const token = await getAdminToken();
  if (!token) throw new Error('Admin session expired');

  const buildOptions = (accessToken) => ({
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let response = await fetchAcrossBases(path, () => buildOptions(token));

  if (response.status === 401 || response.status === 403) {
    try {
      const freshToken = await refreshAdminToken();
      response = await fetchAcrossBases(path, () => buildOptions(freshToken));
    } catch {
      redirectToAdminLogin();
      throw new Error('Admin session expired');
    }
    if (response.status === 401 || response.status === 403) {
      redirectToAdminLogin();
      throw new Error('Admin session expired');
    }
  }

  return response;
}

export async function adminFetchJSON(path, options = {}) {
  const response = await adminFetch(path, options);
  if (!isJsonResponse(response)) {
    throw new Error('API returned a non-JSON response. Check backend connection and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (HTTP ${response.status})`);
  }
  return data;
}
