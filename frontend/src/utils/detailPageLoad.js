/**
 * Shared helpers for public detail pages (trek / run / community / club).
 * Prevents slow-network and cold-start failures from showing as "not found".
 */

export function classifyDetailLoadError(err) {
  if (!err) return 'failed';
  if (err.status === 404) return 'not_found';
  if (
    err.isNetworkError
    || err.code === 'ERR_NETWORK'
    || err.code === 'ECONNABORTED'
    || err.code === 'ERR_NOT_JSON'
  ) {
    return 'network';
  }
  const status = Number(err.status);
  // Rate limits and gateway errors — retry, do not show "not found"
  if (status === 429) return 'server';
  // 5xx (and gateway timeouts) — worth retrying; other 4xx client errors are not
  if (status >= 500 && status <= 599) return 'server';
  return 'failed';
}

export function isTransientDetailError(kind) {
  return kind === 'network' || kind === 'server';
}

export function createDetailCache(prefix) {
  const read = (key) => {
    if (!key) return null;
    try {
      const raw = sessionStorage.getItem(`${prefix}${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      if (key && value) sessionStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
    } catch {
      /* storage full / private mode */
    }
  };
  return { read, write };
}

/** Default public detail fetch options — cold Railway + slow mobile. */
export const DETAIL_FETCH_OPTS = {
  retries: 3,
  timeout: 25000,
  cacheBust: true,
};
