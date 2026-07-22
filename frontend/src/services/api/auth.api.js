/**
 * Authenticated user API — token helpers, strict fetch, legacy auth client shim.
 */
import { resolveUrl } from './client.js';
import { resolveAuthToken, getBearerAuthHeaders, isTokenExpired, isBackendUserJwt, isAuthFailureMessage, clearStoredAuthSession } from '../../utils/authToken.js';
import { clearAuthSession, persistAuthSession } from '../../utils/authStorage.js';

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
 * Authenticated fetch returning raw Response.
 * Tries a silent JWT refresh on 401 before forcing login.
 */
export async function userApiCall(url, options = {}) {
  try {
    let token = resolveAuthToken();
    if (token && isTokenExpired(token)) {
      token = await tryRefreshAuthToken(token);
    }

    const doFetch = (bearerToken) => fetch(resolveUrl(url), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(bearerToken && { Authorization: `Bearer ${bearerToken}` }),
        ...(options.headers || {}),
      },
      credentials: options.credentials ?? 'include',
      mode: options.mode ?? 'cors',
    });

    let response = await doFetch(token);

    if (response.status === 401) {
      const hadToken = !!resolveAuthToken(token);
      const refreshed = await tryRefreshAuthToken(token);
      if (refreshed) {
        response = await doFetch(refreshed);
      } else if (hadToken && resolveAuthToken()) {
        // Refresh failed on network — keep session, do not force login
        return response;
      }
    }

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

function broadcastSessionRefresh(user, token) {
  persistAuthSession(user, token);
  try {
    window.dispatchEvent(new CustomEvent('crwdctrl:session-refreshed', { detail: { user, token } }));
  } catch {
    /* ignore */
  }
}

async function tryRefreshAuthToken(token) {
  const source = resolveAuthToken(token);
  if (!source || !isBackendUserJwt(source)) {
    clearStoredAuthSession();
    return null;
  }
  try {
    const refreshed = await refreshUserSession(source);
    if (refreshed?.token && refreshed?.user) {
      broadcastSessionRefresh(refreshed.user, refreshed.token);
      return refreshed.token;
    }
  } catch (err) {
    if (isAuthFailureMessage(err?.message)) {
      clearStoredAuthSession();
    }
  }
  return null;
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
  if (!token || isTokenExpired(token)) {
    token = await tryRefreshAuthToken(token || options.token);
  }
  if (!token) {
    const err = new Error('Authentication failed. Please log in again.');
    err.code = 'NO_AUTH_TOKEN';
    throw err;
  }

  const bustPath = options.cacheBust === false
    ? path
    : `${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`;

  const doFetch = (bearerToken) => fetch(resolveUrl(bustPath), {
    method: options.method ?? 'GET',
    credentials: options.credentials ?? 'include',
    mode: 'cors',
    headers: {
      ...getBearerAuthHeaders(bearerToken),
      ...(options.headers || {}),
    },
    signal: options.signal,
  });

  let response = await doFetch(token);

  if (response.status === 401) {
    const refreshed = await tryRefreshAuthToken(token);
    if (refreshed) {
      token = refreshed;
      response = await doFetch(token);
    }
  }

  if (response.status === 401) {
    clearStoredAuthSession();
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

/** Authenticated fetch for absolute API URLs (e.g. QR ticket, invoice). Refreshes stale JWTs. */
export async function authenticatedFetchJSON(url, options = {}) {
  let token = resolveAuthToken(options.token);
  if (!token || isTokenExpired(token)) {
    token = await tryRefreshAuthToken(token || options.token);
  }
  if (!token) {
    throw new Error('Please log in to continue.');
  }

  const doFetch = (bearerToken) => fetch(url, {
    method: options.method ?? 'GET',
    credentials: options.credentials ?? 'include',
    mode: options.mode ?? 'cors',
    headers: {
      ...getBearerAuthHeaders(bearerToken),
      ...(options.headers || {}),
    },
    signal: options.signal,
    body: options.body,
  });

  let response = await doFetch(token);
  let data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    const refreshed = await tryRefreshAuthToken(token);
    if (refreshed) {
      token = refreshed;
      response = await doFetch(token);
      data = await response.json().catch(() => ({}));
    }
  }

  if (response.status === 401) {
    clearStoredAuthSession();
    const err = new Error('Authentication failed. Please log in again.');
    err.code = 'AUTH_401';
    throw err;
  }
  if (!response.ok) {
    const err = new Error(data.message || data.error || `Request failed (${response.status})`);
    if (isAuthFailureMessage(err.message)) {
      err.code = 'AUTH_401';
      clearStoredAuthSession();
    }
    throw err;
  }
  return data;
}

export async function fetchMyRegistrations(options = {}) {
  return userFetchJSONStrict('/registrations/my-registrations', options);
}

export async function fetchMySportsRegistrations(options = {}) {
  return userFetchJSONStrict('/category-registrations/my?category=sports', options);
}
