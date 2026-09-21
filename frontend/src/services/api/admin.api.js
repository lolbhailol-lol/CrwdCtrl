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

async function fetchAcrossBases(path, buildOptions, { timeout = 45000 } = {}) {
  const bases = getApiBaseCandidates();
  let lastError = null;

  for (let i = 0; i < bases.length; i += 1) {
    const url = resolveUrl(path, bases[i]);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeout)
      : null;
    try {
      const options = buildOptions();
      const response = await fetch(url, {
        ...options,
        signal: controller?.signal || options.signal,
      });
      // SPA HTML shell or static-host 405 (missing /api proxy) → try next base
      if (response.ok && !isJsonResponse(response) && i < bases.length - 1) {
        lastError = new Error('Non-JSON API response');
        continue;
      }
      if ((response.status === 404 || response.status === 405) && i < bases.length - 1) {
        lastError = new Error(`API proxy miss (HTTP ${response.status})`);
        continue;
      }
      return response;
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      lastError = aborted
        ? Object.assign(new Error('Request timed out — try again'), { code: 'TIMEOUT', status: 408 })
        : err;
      if (i < bases.length - 1) continue;
      throw lastError;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
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
  const { redirectOnFail = true, timeout = 45000, ...fetchOptions } = options;
  const token = await getAdminToken({ redirectOnFail });
  if (!token) throw new Error('Admin session expired');

  const buildOptions = (accessToken) => ({
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(fetchOptions.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let response = await fetchAcrossBases(path, () => buildOptions(token), { timeout });

  if (response.status === 401 || response.status === 403) {
    try {
      const freshToken = await refreshAdminToken();
      response = await fetchAcrossBases(path, () => buildOptions(freshToken), { timeout });
    } catch {
      if (redirectOnFail) redirectToAdminLogin();
      throw new Error('Admin session expired');
    }
    if (response.status === 401 || response.status === 403) {
      if (redirectOnFail) redirectToAdminLogin();
      throw new Error('Admin session expired');
    }
  }

  return response;
}

export async function adminFetchJSON(path, options = {}) {
  const response = await adminFetch(path, options);
  if (!isJsonResponse(response)) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw Object.assign(
        new Error('Server briefly unavailable — try again in a few seconds.'),
        { status: response.status, code: 'UPSTREAM_UNAVAILABLE' },
      );
    }
    throw new Error('API returned a non-JSON response. Check backend connection and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error(
      data?.message || data?.error || `Request failed (HTTP ${response.status})`,
    );
    err.status = response.status;
    err.code = data?.code;
    err.data = data;
    throw err;
  }
  return data;
}

/** Download a binary/text attachment (CSV export, etc.). */
export async function adminFetchDownload(path, options = {}) {
  const response = await adminFetch(path, options);
  if (!response.ok) {
    let message = `Download failed (HTTP ${response.status})`;
    try {
      if (isJsonResponse(response)) {
        const data = await response.json();
        message = data?.message || data?.error || message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  return { blob, filename: match?.[1] || 'download.csv' };
}
