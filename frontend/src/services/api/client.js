import { getApiBaseUrl, getApiBaseCandidates } from '../../config/apiBase.js';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken.js';

/** Resolved at call time so production web can use same-origin `/api`. */
export function getResolvedApiBaseUrl() {
  return getApiBaseUrl();
}

/** @deprecated Prefer resolveUrl() / getResolvedApiBaseUrl() — kept for existing imports. */
export const API_BASE_URL = getApiBaseUrl();

export function resolveUrl(path, base = getApiBaseUrl()) {
  if (!path) return base;
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
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
 * Authenticated user JSON fetch. Returns null when unauthenticated, offline,
 * or on any HTTP/network error (callers should treat null as soft failure).
 */
export async function userFetchJSON(path, options = {}) {
  const token = resolveAuthToken(options.token);
  if (!token) return null;

  try {
    const response = await fetch(resolveUrl(path), {
      ...options,
      credentials: options.credentials ?? 'include',
      headers: {
        ...getBearerAuthHeaders(token),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) return null;
    return response.json().catch(() => null);
  } catch {
    // Backend restart / offline / CORS blip — keep UI quiet
    return null;
  }
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
    || err?.message?.includes('Network')
    || err?.message?.includes('timeout')
    || err?.code === 'ERR_NOT_JSON';
}

function shouldRetryStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function withCacheBust(path, cacheBust) {
  if (!cacheBust) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}_cb=${Date.now()}`;
}

function getPublicFetchTimeout(options = {}) {
  if (options.timeout) return options.timeout;
  const fromEnv = parseInt(import.meta.env.VITE_API_TIMEOUT, 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.max(fromEnv, isIOSBrowser() ? 20000 : 15000);
  }
  return isIOSBrowser() ? 20000 : 15000;
}

/** Prefer Railway, then same-origin — covers Vercel proxy blips and bad mobile DNS. */
function getFetchBases() {
  return getApiBaseCandidates();
}

/**
 * Public JSON fetch with timeout, iOS-friendly defaults, and network retry.
 * Returns axios-like `{ data, headers }` for drop-in replacement in page helpers.
 */
export async function publicFetchJSONRetry(path, options = {}) {
  const timeout = getPublicFetchTimeout(options);
  const maxRetries = options.retries ?? 3;
  const bases = getFetchBases();

  const attemptFetch = async (retryCount = 0, baseIndex = 0) => {
    if (options.signal?.aborted) {
      const error = new Error('Request aborted');
      error.code = 'ECONNABORTED';
      error.isNetworkError = true;
      throw error;
    }

    const base = bases[Math.min(baseIndex, bases.length - 1)];
    const url = resolveUrl(withCacheBust(path, options.cacheBust), base);
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
        if (shouldRetryStatus(response.status) && retryCount < maxRetries && !options.signal?.aborted) {
          // After a couple of server failures, flip to Railway fallback base
          const nextBase = retryCount >= 1 && baseIndex < bases.length - 1 ? baseIndex + 1 : baseIndex;
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return attemptFetch(retryCount + 1, nextBase);
        }
        throw err;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Same-origin /api hit the SPA HTML shell (proxy missing) — try Railway next
        const err = new Error('Non-JSON response');
        err.code = 'ERR_NOT_JSON';
        err.isNetworkError = true;
        if (baseIndex < bases.length - 1) {
          return attemptFetch(retryCount, baseIndex + 1);
        }
        throw err;
      }

      const data = await response.json();
      return {
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (options.signal?.aborted) {
        const error = new Error('Request aborted');
        error.code = 'ECONNABORTED';
        error.isNetworkError = true;
        throw error;
      }

      if (err?.status && !isNetworkFetchError(err) && !shouldRetryStatus(err.status)) {
        throw err;
      }

      const canRetry = (isNetworkFetchError(err) || shouldRetryStatus(err?.status)) && retryCount < maxRetries;
      if (canRetry) {
        const nextBase = (isNetworkFetchError(err) || err?.code === 'ERR_NOT_JSON')
          && baseIndex < bases.length - 1
          ? baseIndex + 1
          : baseIndex;
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return attemptFetch(retryCount + 1, nextBase);
      }

      if (err.name === 'AbortError') {
        const error = new Error('Request timeout');
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
  const timeout = getPublicFetchTimeout(options);

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
