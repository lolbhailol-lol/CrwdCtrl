const DEFAULT_TTL_MS = 3000;
const MAX_ENTRIES = 50;

const snapshots = new Map();

function pruneSnapshots(nowMs) {
  for (const [key, entry] of snapshots) {
    if (!entry.pending && entry.expiresAt <= nowMs) snapshots.delete(key);
  }
  while (snapshots.size > MAX_ENTRIES) {
    snapshots.delete(snapshots.keys().next().value);
  }
}

/**
 * Share one short-lived public leaderboard read across a crowd and coalesce a
 * simultaneous cold load into one database request. Admin/player-private reads
 * intentionally bypass this cache.
 */
async function getPublicLeaderboardSnapshot(
  eventId,
  loader,
  { ttlMs = DEFAULT_TTL_MS, now = Date.now } = {},
) {
  const key = String(eventId || '');
  const nowMs = now();
  const existing = snapshots.get(key);

  if (existing?.value !== undefined && existing.expiresAt > nowMs) {
    return existing.value;
  }
  if (existing?.pending) return existing.pending;

  const pending = Promise.resolve().then(loader);
  snapshots.set(key, { pending, value: existing?.value, expiresAt: 0 });

  try {
    const value = await pending;
    snapshots.set(key, {
      pending: null,
      value,
      expiresAt: now() + Math.max(250, Number(ttlMs) || DEFAULT_TTL_MS),
    });
    pruneSnapshots(now());
    return value;
  } catch (error) {
    if (snapshots.get(key)?.pending === pending) snapshots.delete(key);
    throw error;
  }
}

function clearPublicLeaderboardCache(eventId) {
  if (eventId == null) snapshots.clear();
  else snapshots.delete(String(eventId));
}

module.exports = {
  DEFAULT_TTL_MS,
  getPublicLeaderboardSnapshot,
  clearPublicLeaderboardCache,
};
