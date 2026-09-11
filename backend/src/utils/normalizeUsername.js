/**
 * Shared organizer username normalizer (trek + run club).
 */
function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

module.exports = { normalizeUsername };
