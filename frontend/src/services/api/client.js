import { getApiBaseUrl } from '../../config/apiBase.js';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken.js';

export const API_BASE_URL = getApiBaseUrl();

export function resolveUrl(path) {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

/**
 * Public JSON fetch (no auth). Used by search and health checks.
 */
export async function publicFetchJSON(path, options = {}) {
  const response = await fetch(resolveUrl(path), {
    credentials: options.credentials ?? 'omit',
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (HTTP ${response.status})`);
  }
  return data;
}

/**
 * Authenticated user JSON fetch. Returns null when unauthenticated or on error.
 */
export async function userFetchJSON(path, options = {}) {
  const token = resolveAuthToken(options.token);
  if (!token) return null;

  const response = await fetch(resolveUrl(path), {
    ...options,
    credentials: options.credentials ?? 'include',
    headers: {
      ...getBearerAuthHeaders(token),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) return null;
  return response.json();
}

function isIOSBrowser() {
  const userAgent = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(userAgent)
    || (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent));
}

function isNetworkFetchError(err) {
  return err?.name === 'AbortError'
    || err?.name === 'TypeError'
    || err?.message?.includes('Failed to fetch')
    || err?.message?.includes('Network');
}

function withCacheBust(path, cacheBust) {
  if (!cacheBust) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}_cb=${Date.now()}`;
}

function getPublicFetchTimeout(options = {}) {
  if (options.timeout) return options.timeout;
  return isIOSBrowser() ? 20000 : 10000;
}

/**
 * Public JSON fetch with timeout, iOS-friendly defaults, and network retry.
 * Returns axios-like `{ data, headers }` for drop-in replacement in page helpers.
 */
export async function publicFetchJSONRetry(path, options = {}) {
  const url = resolveUrl(withCacheBust(path, options.cacheBust));
  const timeout = getPublicFetchTimeout(options);
  const maxRetries = options.retries ?? 3;
  const useRetry = !options.signal;

  const attemptFetch = async (retryCount = 0) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        credentials: options.credentials ?? 'omit',
        mode: 'cors',
        headers: {
          Accept: 'application/json',
          ...(options.cacheControl !== false ? { 'Cache-Control': 'no-cache' } : {}),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }

      const data = await response.json();
      return {
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (isNetworkFetchError(err) && useRetry && retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return attemptFetch(retryCount + 1);
      }

      if (err.name === 'AbortError') {
        const error = new Error(options.signal?.aborted ? 'Request aborted' : 'Request timeout');
        error.code = 'ECONNABORTED';
        error.isNetworkError = true;
        throw error;
      }

      if (isNetworkFetchError(err)) {
        const error = new Error('Network Error');
        error.code = 'ERR_NETWORK';
        error.isNetworkError = true;
        throw error;
      }

      throw err;
    }
  };

  return attemptFetch();
}

/**
 * iOS/Safari-friendly public fetch returning raw Response.
 */
export async function publicFetch(path, options = {}) {
  const timeout = isIOSBrowser() ? 20000 : 10000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resolveUrl(path), {
      ...options,
      signal: controller.signal,
      credentials: options.credentials ?? 'omit',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
