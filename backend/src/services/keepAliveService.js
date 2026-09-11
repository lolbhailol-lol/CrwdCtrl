/**
 * External + self keep-alive for the Railway API.
 *
 * Railway does not sleep paid services, but:
 * - GitHub Actions cron can wake / detect cold starts after failed deploys
 * - In-process pings keep Mongo / HTTP path warm and log outages early
 *
 * Enable with RAILWAY_KEEP_ALIVE_URL (full URL) or RAILWAY_PUBLIC_DOMAIN.
 * Disable with KEEP_ALIVE_ENABLED=false.
 */
const { logger } = require('../utils/logger');

const INTERVAL_MS = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || 4 * 60 * 1000;
const TIMEOUT_MS = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 25_000;

function resolveKeepAliveUrl() {
  const explicit = String(process.env.RAILWAY_KEEP_ALIVE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const domain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  if (domain) {
    const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}/api/keep-alive`;
  }

  return '';
}

async function ping(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'CrwdCtrl-KeepAlive/1.0', Accept: 'application/json' },
    });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

function initKeepAlive() {
  if (String(process.env.KEEP_ALIVE_ENABLED || 'true').toLowerCase() === 'false') {
    logger.info('Keep-alive disabled via KEEP_ALIVE_ENABLED');
    return;
  }

  const url = resolveKeepAliveUrl();
  if (!url) {
    logger.info('Keep-alive skipped (no RAILWAY_KEEP_ALIVE_URL / RAILWAY_PUBLIC_DOMAIN)');
    return;
  }

  let consecutiveFailures = 0;

  const tick = async () => {
    try {
      const result = await ping(url);
      if (result.ok) {
        if (consecutiveFailures > 0) {
          logger.info('Keep-alive recovered', { url, status: result.status, afterFailures: consecutiveFailures });
        }
        consecutiveFailures = 0;
      } else {
        consecutiveFailures += 1;
        logger.warn('Keep-alive non-OK', { url, status: result.status, consecutiveFailures });
      }
    } catch (err) {
      consecutiveFailures += 1;
      logger.warn('Keep-alive ping failed', {
        url,
        error: err.message,
        consecutiveFailures,
      });
    }
  };

  // First ping shortly after boot (lets healthcheck settle), then on interval
  setTimeout(tick, 15_000);
  setInterval(tick, INTERVAL_MS);

  logger.info('Keep-alive started', { url, intervalMs: INTERVAL_MS });
}

module.exports = { initKeepAlive, resolveKeepAliveUrl };
