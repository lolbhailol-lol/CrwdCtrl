/**
 * Authenticated user API — token helpers, strict fetch, legacy auth client shim.
 */
import { resolveUrl } from './client.js';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken.js';
import { clearAuthSession } from '../../utils/authStorage.js';

/** @deprecated Implementation lives in utils/api.js — migrate callers gradually */
export { authAPI, handleApiError, ApiError } from '../../utils/api.js';

export function getUserAuthHeaders(token) {
  const resolved = resolveAuthToken(token);
  if (resolved) {
    return {
      Authorization: `Bearer ${resolved}`,
      'Content-Type': 'application/json',
    };
  }
  return { 'Content-Type': 'application/json' };
}

/**
 * Authenticated fetch returning raw Response. Redirects to /login on 401.
 */
export async function userApiCall(url, options = {}) {
  try {
    const token = resolveAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    };

    const response = await fetch(resolveUrl(url), {
      ...options,
      headers,
      credentials: options.credentials ?? 'include',
      mode: options.mode ?? 'cors',
    });

    if (response.status === 401) {
      clearAuthSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return response;
    }

    return response;
  } catch (err) {
    console.error('API call failed:', err);
    throw new Error('Failed to connect to the server. Please try again later.');
  }
}

export async function validateUserToken(token) {
  if (!token) return false;
  try {
    const response = await fetch(resolveUrl('/users/validate'), {
      headers: getUserAuthHeaders(token),
      credentials: 'include',
      mode: 'cors',
    });
    return response.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/** Renew JWT using a still-trusted (possibly expired) session token. */
export async function refreshUserSession(token) {
  const resolved = resolveAuthToken(token);
  if (!resolved) return null;
  const response = await fetch(resolveUrl('/users/session/refresh'), {
    method: 'POST',
    headers: getBearerAuthHeaders(resolved),
    credentials: 'include',
    mode: 'cors',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || 'Session refresh failed');
  }
  return {
    token: data.data?.token,
    user: data.data?.user,
  };
}

/**
 * Authenticated JSON fetch that throws on 401 or non-OK responses.
 */
export async function userFetchJSONStrict(path, options = {}) {
  let token = resolveAuthToken(options.token);
  // Brief retry — AuthContext can set isAuthenticated before localStorage settles
  if (!token) {
    await new Promise((r) => setTimeout(r, 120));
    token = resolveAuthToken(options.token);
  }
  if (!token) {
    await new Promise((r) => setTimeout(r, 280));
    token = resolveAuthToken(options.token);
  }
  if (!token) {
    const err = new Error('Authentication failed. Please log in again.');
    err.code = 'NO_AUTH_TOKEN';
    throw err;
  }

  const bustPath = options.cacheBust === false
    ? path
    : `${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`;

  const response = await fetch(resolveUrl(bustPath), {
    method: options.method ?? 'GET',
    credentials: options.credentials ?? 'include',
    mode: 'cors',
    headers: {
      ...getBearerAuthHeaders(token),
      ...(options.headers || {}),
    },
    signal: options.signal,
  });

        if (response.status === 401) {
    const err = new Error('Authentication failed. Please log in again.');
    err.code = 'AUTH_401';
    throw err;
  }
  if (!response.ok) {
    const err = new Error(`Failed to fetch (${response.status})`);
    err.code = response.status === 404 ? 'NOT_FOUND' : `HTTP_${response.status}`;
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function fetchMyRegistrations(options = {}) {
  return userFetchJSONStrict('/registrations/my-registrations', options);
}

export async function fetchMySportsRegistrations(options = {}) {
  return userFetchJSONStrict('/category-registrations/my?category=sports', options);
}
