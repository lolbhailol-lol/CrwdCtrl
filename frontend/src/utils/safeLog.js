/**
 * Redact Firebase / Google API keys and similar secrets from console output.
 * Firebase client apiKeys are public-by-design but must not be echoed in logs.
 */

export function redactSecrets(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value
      .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]')
      .replace(/apiKey=([^&\s"']+)/gi, 'apiKey=[REDACTED]')
      .replace(/["']apiKey["']\s*:\s*["'][^"']+["']/gi, '"apiKey":"[REDACTED]"')
      .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
  }
  if (value instanceof Error) {
    const msg = redactSecrets(value.message || String(value));
    const code = value.code ? ` (${value.code})` : '';
    return `${msg}${code}`;
  }
  if (typeof value === 'object') {
    try {
      return redactSecrets(JSON.stringify(value));
    } catch {
      return '[object]';
    }
  }
  return value;
}

export function safeConsoleError(...args) {
  // eslint-disable-next-line no-console
  console.error(...args.map(redactSecrets));
}

export function safeConsoleWarn(...args) {
  // eslint-disable-next-line no-console
  console.warn(...args.map(redactSecrets));
}

/** Dev-only info logs — silent in production. */
export function safeConsoleLog(...args) {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.log(...args.map(redactSecrets));
}
