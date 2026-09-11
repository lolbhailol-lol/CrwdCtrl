import { OFFLINE_QR_TYPES } from './constants';

async function hmacHex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(key || 'offline')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 20);
}

function canonical(obj) {
  const { sig: _sig, ...rest } = obj;
  return JSON.stringify(rest);
}

export async function signPayload(signingKey, payload) {
  const sig = await hmacHex(signingKey, canonical(payload));
  return { ...payload, sig };
}

export async function verifyPayload(signingKey, payload) {
  if (!payload || typeof payload !== 'object') return false;
  const expected = await hmacHex(signingKey, canonical(payload));
  return Boolean(payload.sig) && payload.sig === expected;
}

export function parseQrJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function buildMemberProofPayload({ bundle, session, checkpointKey, checkpointId }) {
  return signPayload(bundle.signingKey, {
    t: OFFLINE_QR_TYPES.MEMBER_SCAN_PROOF,
    v: 1,
    team: bundle.team.teamCode,
    event: bundle.event.id,
    cp: String(checkpointId || ''),
    key: String(checkpointKey),
    slot: session.memberKey,
    name: session.name,
    at: Date.now(),
  });
}

export async function buildTeamSyncPayload({ bundle, state }) {
  return signPayload(bundle.signingKey, {
    t: OFFLINE_QR_TYPES.TEAM_STATE_SYNC,
    v: 1,
    team: bundle.team.teamCode,
    event: bundle.event.id,
    seq: state.seq || 0,
    stage: state.currentStage,
    score: state.score,
    clues: state.clueProgress,
    cps: state.checkpoints,
    finishedAt: state.finishedAt || null,
    at: Date.now(),
  });
}

export async function buildResultsPayload({ bundle, state }) {
  const clues = {};
  for (const [n, row] of Object.entries(state.clueProgress || {})) {
    clues[n] = {
      state: row.state,
      attempts: row.attempts,
      awardedPoints: row.awardedPoints || 0,
      hintUsed: Boolean(row.hintUsed),
      failureReason: row.failureReason || null,
    };
  }
  return signPayload(bundle.signingKey, {
    t: OFFLINE_QR_TYPES.RESULTS_EXPORT,
    v: 1,
    team: bundle.team.teamCode,
    teamName: bundle.team.teamName,
    event: bundle.event.id,
    eventSlug: bundle.event.slug,
    score: state.score,
    stage: state.currentStage,
    seq: state.seq || 0,
    clues,
    finishedAt: state.finishedAt || new Date().toISOString(),
    exportedAt: new Date().toISOString(),
  });
}

/** Spare-phone failover: restore full hunt state on another device. */
export async function buildPhoneBackupPayload({ bundle, state, session }) {
  return signPayload(bundle.signingKey, {
    t: OFFLINE_QR_TYPES.PHONE_BACKUP,
    v: 1,
    team: bundle.team.teamCode,
    event: bundle.event.id,
    exportBatchId: bundle.exportBatchId || '',
    seq: state.seq || 0,
    stage: state.currentStage,
    score: state.score,
    state,
    session: {
      teamCode: session.teamCode,
      memberKey: session.memberKey,
      name: session.name,
      role: session.role,
    },
    at: Date.now(),
  });
}

export function isPhoneBackup(payload) {
  return payload?.t === OFFLINE_QR_TYPES.PHONE_BACKUP;
}

export function isMemberProof(payload) {
  return payload?.t === OFFLINE_QR_TYPES.MEMBER_SCAN_PROOF;
}

export function isTeamSync(payload) {
  return payload?.t === OFFLINE_QR_TYPES.TEAM_STATE_SYNC;
}

export function isResults(payload) {
  return payload?.t === OFFLINE_QR_TYPES.RESULTS_EXPORT;
}
