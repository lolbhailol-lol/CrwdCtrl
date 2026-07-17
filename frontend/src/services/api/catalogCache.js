import { publicFetchJSONRetry } from './client.js';

/** In-memory catalog cache — dedupes parallel hub-page fetches across navigation. */
const TTL_MS = 2 * 60 * 1000;
const cache = new Map();
const inFlight = new Map();

function cacheKey(path) {
  return String(path)
    .split('?')[0]
    .replace(/\/$/, '');
}

/**
 * Public catalog fetch with in-flight dedup and short TTL.
 * Returns axios-like `{ data, headers }` matching publicFetchJSONRetry.
 */
export async function fetchCatalogJSON(path, options = {}) {
  const { force = false, retries = 1, timeout } = options;
  const key = cacheKey(path);

  if (!force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL_MS) {
      return { data: hit.data, headers: hit.headers };
    }
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }
  }

  const fetchPath = force
    ? `${path}${path.includes('?') ? '&' : '?'}_cb=${Date.now()}`
    : path;

  const promise = publicFetchJSONRetry(fetchPath, {
    retries,
    timeout,
    cacheBust: false,
    cacheControl: force,
  })
    .then((res) => {
      cache.set(key, { data: res.data, headers: res.headers, ts: Date.now() });
      inFlight.delete(key);
      return res;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}

export function invalidateCatalogCache() {
  cache.clear();
  inFlight.clear();
}
