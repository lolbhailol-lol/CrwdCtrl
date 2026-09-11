/**
 * Shared multi-host fetch for Railway + same-origin /api (Caddy proxy).
 * Use for login, payments, and organizer portals so a single bad host never hard-fails.
 */
import { getApiBaseCandidates, getApiBaseUrl, isInAppBrowser } from '../../config/apiBase.js';

export function resolveApiUrl(path, base = getApiBaseUrl()) {
  if (!path) return base;
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function isProxyMissStatus(status) {
  return status === 404 || status === 405;
}

export function isJsonContentType(response) {
  const ct = response.headers.get('content-type') || '';
  return ct.includes('application/json');
}

export async function readResponseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error(
      response.ok
        ? 'Server returned an invalid response. Please try again.'
        : `Request failed (HTTP ${response.status}). Please try again.`,
    );
    err.code = 'ERR_NOT_JSON';
    err.status = response.status;
    err.isNetworkError = true;
    err.rawText = text.slice(0, 200);
    throw err;
  }
}

function isNetworkish(err) {
  return err?.name === 'AbortError'
    || err?.name === 'TypeError'
    || err?.code === 'ERR_NETWORK'
    || err?.code === 'ERR_NOT_JSON'
    || err?.code === 'ECONNABORTED'
    || err?.isNetworkError === true
    || /failed to fetch|network error|load failed|timeout|networkerror|unexpected end of json/i.test(
      String(err?.message || ''),
    );
}

/**
 * Fetch JSON across API bases (Railway + www /api).
 * Returns { data, response, base }.
 */
export async function resilientJsonFetch(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const timeout = options.timeout
    ?? (isInAppBrowser() ? 25000 : 18000);
  const bases = options.bases || getApiBaseCandidates();
  let lastError = null;

  let body = options.body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    body = JSON.stringify(body);
  }

  for (let i = 0; i < bases.length; i += 1) {
    const base = bases[i];
    const url = resolveApiUrl(path, base);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const isSameOriginBase = typeof window !== 'undefined' && base.startsWith(window.location.origin);

    try {
      const response = await fetch(url, {
        method,
        credentials: options.credentials ?? 'omit',
        mode: isSameOriginBase ? 'same-origin' : 'cors',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...(typeof body === 'string' && !(options.body instanceof FormData)
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(options.headers || {}),
        },
        ...(body != null && method !== 'GET' && method !== 'HEAD' ? { body } : {}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (options.rawResponse) {
        return { response, base, data: null };
      }

      // Static host miss / SPA HTML — try next API host
      if ((!isJsonContentType(response) || isProxyMissStatus(response.status)) && i < bases.length - 1) {
        // Consume body so the connection can close cleanly
        await response.text().catch(() => '');
        lastError = new Error(`API host miss (HTTP ${response.status})`);
        lastError.status = response.status;
        lastError.isNetworkError = true;
        continue;
      }

      const data = await readResponseJson(response);
      return { data, response, base };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (options.signal?.aborted) throw err;
      if (isNetworkish(err) && i < bases.length - 1) continue;
      throw err;
    }
  }

  throw lastError || new Error('Could not reach the API. Please try again.');
}
