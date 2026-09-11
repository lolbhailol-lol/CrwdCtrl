/**
 * Simple idempotency helpers for challenge/hint operations.
 */

function buildIdempotencyKey(parts = []) {
  return parts.filter((p) => p != null && p !== '').map(String).join(':');
}

/**
 * If the request carries Idempotency-Key / body.requestId, return it;
 * otherwise derive a stable key from action identity.
 */
function resolveRequestId(req, fallbackParts = []) {
  const header = req.get?.('Idempotency-Key') || req.headers?.['idempotency-key'];
  if (header && String(header).trim()) return String(header).trim().slice(0, 128);
  if (req.body?.requestId) return String(req.body.requestId).trim().slice(0, 128);
  return buildIdempotencyKey(fallbackParts);
}

module.exports = {
  buildIdempotencyKey,
  resolveRequestId,
};
