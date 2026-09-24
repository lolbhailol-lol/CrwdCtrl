/**
 * Best-effort live board sync — never blocks play.
 */

import { getApiBaseCandidates } from '../../../config/apiBase.js';
import { signPayload } from './offlineQr.js';

const QUEUE_KEY = 'progress_queue';
const DEVICE_KEY = 'device_id';
const SYNC_PAUSE_KEY = 'ch_offline_board_sync_paused';
const NETWORK_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Block interval / online pushes while Start over is resetting the live board. */
export function pauseOfflineBoardSync() {
  try {
    sessionStorage.setItem(SYNC_PAUSE_KEY, '1');
  } catch { /* ignore */ }
}

export function resumeOfflineBoardSync() {
  try {
    sessionStorage.removeItem(SYNC_PAUSE_KEY);
  } catch { /* ignore */ }
}

export function isOfflineBoardSyncPaused() {
  try {
    return sessionStorage.getItem(SYNC_PAUSE_KEY) === '1';
  } catch {
    return false;
  }
}

function resolveApiBases(bundle) {
  const fromBundle = String(bundle?.event?.apiBase || '').replace(/\/$/, '');
  const candidates = [];
  if (fromBundle) candidates.push(fromBundle);
  try {
    candidates.push(...getApiBaseCandidates());
  } catch { /* ignore */ }
  // Same-origin relative fallback (www Caddy proxy)
  if (typeof window !== 'undefined') candidates.push('');
  return [...new Set(candidates.map((b) => String(b || '').replace(/\/$/, '')))];
}

function progressPath(eventId) {
  return `/campus-hunt/events/${eventId}/offline-progress`;
}

export function getOfflineDeviceId() {
  try {
    let id = localStorage.getItem(`ch_offline_${DEVICE_KEY}`);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(`ch_offline_${DEVICE_KEY}`, id);
    }
    return id;
  } catch {
    return `dev_tmp_${Date.now()}`;
  }
}

/** New phone / spare restore — next board sync claims this device. */
export function rotateOfflineDeviceIdForTakeover() {
  try {
    const id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(`ch_offline_${DEVICE_KEY}`, id);
    localStorage.setItem('ch_offline_takeover_once', '1');
    const queue = loadQueue().map((item) => ({
      ...item,
      deviceId: id,
      takeover: true,
      sig: '',
    }));
    saveQueue(queue);
    return id;
  } catch {
    return getOfflineDeviceId();
  }
}

function consumeTakeoverFlag() {
  try {
    const once = localStorage.getItem('ch_offline_takeover_once') === '1';
    if (once) localStorage.removeItem('ch_offline_takeover_once');
    return once;
  } catch {
    return false;
  }
}

function loadQueue() {
  try {
    const raw = localStorage.getItem(`ch_offline_${QUEUE_KEY}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(items) {
  try {
    localStorage.setItem(`ch_offline_${QUEUE_KEY}`, JSON.stringify(items.slice(-20)));
  } catch { /* ignore */ }
}

/** Drop queued sync rows for a team (used by Start over). */
export function clearOfflineProgressQueue(teamCode) {
  const code = String(teamCode || '').toUpperCase();
  if (!code) {
    saveQueue([]);
    return;
  }
  saveQueue(loadQueue().filter((item) => String(item.team || '').toUpperCase() !== code));
}

function buildProgressUrl(base, eventId) {
  const path = progressPath(eventId);
  if (!base) return `/api${path}`;
  if (base.endsWith('/api')) return `${base}${path}`;
  if (base.includes('/api/')) return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  return `${base}/api${path}`;
}

export async function enqueueOfflineProgress(bundle, state, { startOver = false } = {}) {
  if (!bundle?.event?.id || !bundle?.team?.teamCode) return { queued: false };
  // During Start over, only the explicit startOver sync may talk to the board.
  if (!startOver && isOfflineBoardSyncPaused()) {
    return { queued: false, paused: true, syncedOk: false };
  }
  const takeover = consumeTakeoverFlag();
  let payload = {
    t: 'campus_hunt_offline_progress',
    event: String(bundle.event.id),
    team: bundle.team.teamCode,
    score: Number(state.score) || 0,
    stage: state.currentStage,
    seq: Number(state.seq) || 0,
    huntStartedAt: state.huntStartedAt || undefined,
    finishedAt: state.finishedAt || undefined,
    clue4Points: state.clueProgress?.[4]?.state === 'COMPLETED'
      ? Number(state.clueProgress[4].awardedPoints)
      : undefined,
    clue6Points: state.currentStage === 'SCORE_LOCKED'
      ? Number(state.clueProgress?.[6]?.awardedPoints) || 0
      : undefined,
    deviceId: getOfflineDeviceId(),
    takeover: takeover || undefined,
    startOver: startOver || undefined,
    at: new Date().toISOString(),
  };
  try {
    if (bundle.signingKey) {
      payload = await signPayload(bundle.signingKey, payload);
    }
  } catch {
    payload.sig = payload.sig || '';
  }
  // Keep only the latest snapshot per team (reduces lag + stale seq fights).
  const queue = loadQueue().filter((item) => String(item.team) !== String(payload.team));
  queue.push(payload);
  saveQueue(queue);
  let result = await flushOfflineProgressQueue(bundle);

  // Seq behind server after a prior run — jump ahead and retry once.
  if (
    !result?.syncedOk
    && result?.ignoredReason === 'STALE_SEQ'
    && result?.seq != null
    && !startOver
  ) {
    let retry = {
      ...payload,
      seq: Number(result.seq) + 1,
      at: new Date().toISOString(),
      sig: undefined,
    };
    try {
      if (bundle.signingKey) retry = await signPayload(bundle.signingKey, retry);
    } catch { /* keep */ }
    const q2 = loadQueue().filter((item) => String(item.team) !== String(retry.team));
    q2.push(retry);
    saveQueue(q2);
    result = await flushOfflineProgressQueue(bundle);
    if (result?.syncedOk) {
      result.seqRecovered = retry.seq;
    }
  }

  return { queued: true, ...result };
}

export async function flushOfflineProgressQueue(bundle) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { pending: loadQueue().length, synced: false, syncedOk: false };
  }
  let queue = loadQueue();
  if (!queue.length) return { pending: 0, synced: false, syncedOk: false };

  const bases = resolveApiBases(bundle);
  const kept = [];
  let synced = 0;
  let lastSeq = null;
  let lastStartOver = false;
  let lastResetAt = null;
  let lastIgnoreReason = null;
  let lastFinishAward = null;
  let lastFinishPlace = null;
  let lastScore = null;
  let lastRank = null;
  let lastFieldSize = null;

  for (const item of queue) {
    let ok = false;
    let terminalAck = false;
    let deviceBound = false;
    let boundHint;
    for (const base of bases) {
      try {
        const url = buildProgressUrl(base, item.event);
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (res.status === 429) {
          // Rate limited — keep queued; do not burn other bases.
          ok = false;
          lastIgnoreReason = 'RATE_LIMITED';
          break;
        }
        if (res.status === 409) {
          const data = await res.json().catch(() => null);
          if (data?.code === 'DEVICE_BOUND') {
            deviceBound = true;
            boundHint = data?.data?.boundDeviceHint;
            break;
          }
        }
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const body = data?.data || data;
          // Server may return 200 with ignored:true (old SCORE_LOCKED / STALE_SEQ) — not a real sync.
          if (body?.ignored || body?.accepted === false) {
            ok = false;
            lastIgnoreReason = String(body?.reason || 'IGNORED');
            if (body?.seq != null) lastSeq = Number(body.seq);
            // A locked score is final on the server. Retrying the same snapshot
            // on every reconnect can never change it, so acknowledge and drop it.
            terminalAck = lastIgnoreReason === 'SCORE_LOCKED';
            break;
          }
          ok = true;
          synced += 1;
          if (body?.seq != null) lastSeq = Number(body.seq);
          if (body?.startOver) lastStartOver = true;
          if (body?.offlineResetAt) lastResetAt = body.offlineResetAt;
          if (body?.finishAward != null) lastFinishAward = Number(body.finishAward);
          if (body?.finishPlace != null) lastFinishPlace = Number(body.finishPlace);
          if (body?.score != null) lastScore = Number(body.score);
          if (body?.rank != null) lastRank = Number(body.rank);
          if (body?.fieldSize != null) lastFieldSize = Number(body.fieldSize);
          break;
        }
      } catch {
        /* try next base */
      }
    }
    if (deviceBound) {
      const rest = [item, ...queue.slice(queue.indexOf(item) + 1)];
      saveQueue(rest);
      return {
        pending: rest.length,
        synced: false,
        syncedOk: false,
        deviceBound: true,
        boundDeviceHint: boundHint,
      };
    }
    if (!ok && !terminalAck) kept.push(item);
  }
  saveQueue(kept);
  const result = {
    pending: kept.length,
    synced,
    syncedOk: synced > 0,
    seq: lastSeq,
    startOver: lastStartOver || undefined,
    offlineResetAt: lastResetAt || undefined,
    ignoredReason: lastIgnoreReason || undefined,
    finishAward: lastFinishAward,
    finishPlace: lastFinishPlace,
    score: lastScore,
    rank: lastRank,
    fieldSize: lastFieldSize,
  };
  if (result.syncedOk && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('ch-offline-board-synced', {
        detail: {
          rank: lastRank,
          fieldSize: lastFieldSize,
          score: lastScore,
          finishPlace: lastFinishPlace,
        },
      }));
    } catch { /* ignore */ }
  }
  return result;
}

export function offlineBoardPendingCount() {
  return loadQueue().length;
}

/**
 * Fetch / mint Field Terminal device key for Clue 4 (needs brief Wi‑Fi).
 * Patches the in-memory pack clue4 so playData can show the key.
 */
export async function ensureOfflineGridKey(bundle, { forceReset = false } = {}) {
  if (!bundle?.event?.id || !bundle?.team?.teamCode || !bundle?.signingKey) {
    return null;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  let payload = {
    t: 'campus_hunt_offline_grid',
    event: String(bundle.event.id),
    team: bundle.team.teamCode,
    preferredCompletionCode: bundle.clues?.clue4?.answer || '',
    reset: forceReset || undefined,
    forceReset: forceReset || undefined,
    at: new Date().toISOString(),
  };
  try {
    payload = await signPayload(bundle.signingKey, payload);
  } catch {
    return null;
  }

  const bases = resolveApiBases(bundle);
  for (const base of bases) {
    try {
      const path = `/campus-hunt/events/${payload.event}/offline-grid-ensure`;
      const url = !base
        ? `/api${path}`
        : base.endsWith('/api')
          ? `${base}${path}`
          : `${base}/api${path}`;
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      const data = json?.data || json;
      if (data?.gridAccessCode) return data;
    } catch {
      /* try next */
    }
  }
  return null;
}

function pullUrl(base, eventId) {
  const path = `/campus-hunt/events/${eventId}/offline-pull`;
  if (!base) return `/api${path}`;
  if (base.endsWith('/api')) return `${base}${path}`;
  return `${base}/api${path}`;
}

/** Fetch live board + admin Start over stamp from server. */
export async function pullOfflineBoardState(bundle) {
  if (!bundle?.event?.id || !bundle?.team?.teamCode || !bundle?.signingKey) {
    return null;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  let payload = {
    t: 'campus_hunt_offline_pull',
    event: String(bundle.event.id),
    team: bundle.team.teamCode,
    at: new Date().toISOString(),
  };
  try {
    payload = await signPayload(bundle.signingKey, payload);
  } catch {
    return null;
  }

  const bases = resolveApiBases(bundle);
  for (const base of bases) {
    try {
      const res = await fetchWithTimeout(pullUrl(base, payload.event), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      return json?.data || json;
    } catch {
      /* try next */
    }
  }
  return null;
}
