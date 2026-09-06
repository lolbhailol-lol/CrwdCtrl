const CampusHuntFinaleMissionRun = require('../../models/CampusHuntFinaleMissionRun');
const {
  DEFAULT_LOCKBOX_KEY_POOL,
  DEFAULT_LOCKBOX_CODE_POOL,
} = require('../../constants');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getKeyPool(config) {
  const pool = config?.lockbox?.keyPool;
  if (Array.isArray(pool) && pool.length >= 1) return pool;
  return DEFAULT_LOCKBOX_KEY_POOL;
}

function getCodePool(config) {
  const pool = config?.lockbox?.codePool;
  if (Array.isArray(pool) && pool.length >= 1) return pool;
  return DEFAULT_LOCKBOX_CODE_POOL;
}

function normalizeKey(picked) {
  return {
    id: picked.id,
    label: picked.label || picked.id,
    acceptedAnswers: Array.isArray(picked.acceptedAnswers) && picked.acceptedAnswers.length
      ? picked.acceptedAnswers
      : [picked.id, picked.label].filter(Boolean),
  };
}

function normalizeCode(picked) {
  const acceptedCodes = Array.isArray(picked.acceptedCodes) && picked.acceptedCodes.length
    ? picked.acceptedCodes
    : [];
  const playerPieces = Array.isArray(picked.playerPieces) && picked.playerPieces.length
    ? picked.playerPieces.map((p, i) => ({
      seat: Number(p.seat ?? i),
      label: p.label || (i === 0 ? 'Team Leader' : `Player ${i + 1}`),
      info: p.info || '',
    }))
    : [];
  return {
    id: picked.id,
    acceptedCodes,
    playerPieces,
  };
}

/** Usage for load-balancing: active + completed only (abandoned resumable runs keep their claim). */
async function getKeyUsageCounts(eventId) {
  const runs = await CampusHuntFinaleMissionRun.find({
    eventId,
    missionId: 'lockbox',
    status: { $in: ['active', 'completed'] },
  }).select('state').lean();

  const counts = new Map();
  for (const run of runs) {
    const id = run.state?.assignedKeyId;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

async function getCodeUsageCounts(eventId) {
  const runs = await CampusHuntFinaleMissionRun.find({
    eventId,
    missionId: 'lockbox',
    status: { $in: ['active', 'completed'] },
  }).select('state').lean();

  const counts = new Map();
  for (const run of runs) {
    const id = run.state?.assignedCodeId || run.state?.assignedCode?.id;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

async function getActiveKeyIds(eventId) {
  const runs = await CampusHuntFinaleMissionRun.find({
    eventId,
    missionId: 'lockbox',
    status: 'active',
  }).select('state.assignedKeyId').lean();
  return new Set(runs.map((r) => r.state?.assignedKeyId).filter(Boolean));
}

async function getActiveCodeIds(eventId) {
  const runs = await CampusHuntFinaleMissionRun.find({
    eventId,
    missionId: 'lockbox',
    status: 'active',
  }).select('state').lean();
  return new Set(
    runs
      .map((r) => r.state?.assignedCodeId || r.state?.assignedCode?.id)
      .filter(Boolean),
  );
}

function pickLeastUsed(pool, usageCounts, heldIds) {
  const available = pool.filter((item) => !heldIds.has(item.id));
  const candidates = available.length ? available : [...pool];
  const usageOf = (item) => usageCounts.get(item.id) || 0;
  const sorted = [...candidates].sort((a, b) => {
    const diff = usageOf(a) - usageOf(b);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  });
  const minUsage = usageOf(sorted[0]);
  const tier = shuffle(sorted.filter((item) => usageOf(item) === minUsage));
  return tier[0];
}

/**
 * Assign one physical key not held by another active Lockbox run.
 * Retries against concurrent starts.
 */
async function assignLockboxKey({ eventId, config, maxAttempts = 8 } = {}) {
  const pool = getKeyPool(config);
  if (!pool.length) {
    const err = new Error('Lockbox key pool is empty.');
    err.status = 409;
    err.code = 'LOCKBOX_KEY_POOL_EMPTY';
    throw err;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const [usageCounts, held] = await Promise.all([
      getKeyUsageCounts(eventId),
      getActiveKeyIds(eventId),
    ]);
    const picked = pickLeastUsed(pool, usageCounts, held);
    if (!picked) break;
    return normalizeKey(picked);
  }

  const err = new Error('Could not assign a unique Lockbox key. Try again.');
  err.status = 409;
  err.code = 'LOCKBOX_KEY_ASSIGN_FAILED';
  throw err;
}

async function assignLockboxCode({ eventId, config, maxAttempts = 8 } = {}) {
  const pool = getCodePool(config);
  if (!pool.length) {
    // Fall back to legacy single-code config
    const lb = config?.lockbox || {};
    return normalizeCode({
      id: 'code_legacy',
      acceptedCodes: Array.isArray(lb.acceptedCodes) && lb.acceptedCodes.length
        ? lb.acceptedCodes
        : DEFAULT_LOCKBOX_CODE_POOL[0].acceptedCodes,
      playerPieces: Array.isArray(lb.playerPieces) && lb.playerPieces.length
        ? lb.playerPieces
        : DEFAULT_LOCKBOX_CODE_POOL[0].playerPieces,
    });
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const [usageCounts, held] = await Promise.all([
      getCodeUsageCounts(eventId),
      getActiveCodeIds(eventId),
    ]);
    const picked = pickLeastUsed(pool, usageCounts, held);
    if (!picked) break;
    return normalizeCode(picked);
  }

  const err = new Error('Could not assign a Lockbox code set. Try again.');
  err.status = 409;
  err.code = 'LOCKBOX_CODE_ASSIGN_FAILED';
  throw err;
}

/** Most recent abandoned Lockbox run for this team (resume same key/attempts). */
async function findResumableLockboxRun(eventId, teamId) {
  return CampusHuntFinaleMissionRun.findOne({
    eventId,
    teamId,
    missionId: 'lockbox',
    status: 'abandoned',
    'state.assignedKeyId': { $exists: true, $ne: null },
  }).sort({ updatedAt: -1 });
}

/**
 * After creating a run, ensure no other active run holds the same key/code.
 * Returns true if unique; caller should reassign/retry if false.
 */
async function hasActiveAssignmentConflict({ eventId, runId, keyId, codeId }) {
  const conflict = await CampusHuntFinaleMissionRun.findOne({
    eventId,
    missionId: 'lockbox',
    status: 'active',
    _id: { $ne: runId },
    $or: [
      ...(keyId ? [{ 'state.assignedKeyId': keyId }] : []),
      ...(codeId ? [
        { 'state.assignedCodeId': codeId },
        { 'state.assignedCode.id': codeId },
      ] : []),
    ],
  }).select('_id').lean();
  return Boolean(conflict);
}

module.exports = {
  getKeyPool,
  getCodePool,
  getKeyUsageCounts,
  getCodeUsageCounts,
  assignLockboxKey,
  assignLockboxCode,
  findResumableLockboxRun,
  hasActiveAssignmentConflict,
  normalizeKey,
  normalizeCode,
};
