/**
 * Shared admin API helper — consistent token handling for all admin pages.
 * - Refreshes expired access tokens using admin_refresh_token
 * - Redirects to /admin/login when the session can't be recovered
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export function isAdminTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    // 5 min buffer so we refresh before hard expiry
    return Date.now() >= payload.exp * 1000 - 5 * 60 * 1000;
  } catch {
    return true;
  }
}

let refreshPromise = null;

async function refreshAdminToken() {
  const refreshToken = localStorage.getItem('admin_refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  // De-dupe concurrent refreshes (multiple components fetching at once)
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/admin/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Token refresh failed');
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

/** Returns a valid admin access token, refreshing if needed. Redirects to login on failure. */
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

/**
 * Authenticated admin fetch. Path can be relative ('/admin/fests') or absolute.
 * Retries once after refresh on 401/403, then redirects to login.
 * Returns the raw Response.
 */
export async function adminFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
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

  let response = await fetch(url, buildOptions(token));

  if (response.status === 401 || response.status === 403) {
    try {
      const freshToken = await refreshAdminToken();
      response = await fetch(url, buildOptions(freshToken));
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

/** adminFetch + JSON parsing + non-OK error throwing. */
export async function adminFetchJSON(path, options = {}) {
  const response = await adminFetch(path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (HTTP ${response.status})`);
  }
  return data;
}

export { API_BASE_URL };
