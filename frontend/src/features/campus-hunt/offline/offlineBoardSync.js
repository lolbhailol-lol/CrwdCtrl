/**
 * Best-effort live board sync — never blocks play.
 */

import { getApiBaseCandidates } from '../../../config/apiBase';
import { signPayload } from './offlineQr';

const QUEUE_KEY = 'progress_queue';
const DEVICE_KEY = 'device_id';

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

function buildProgressUrl(base, eventId) {
  const path = progressPath(eventId);
  if (!base) return `/api${path}`;
  if (base.endsWith('/api')) return `${base}${path}`;
  if (base.includes('/api/')) return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  return `${base}/api${path}`;
}

export async function enqueueOfflineProgress(bundle, state) {
  if (!bundle?.event?.id || !bundle?.team?.teamCode) return { queued: false };
  const takeover = consumeTakeoverFlag();
  let payload = {
    t: 'campus_hunt_offline_progress',
    event: String(bundle.event.id),
    team: bundle.team.teamCode,
    score: Number(state.score) || 0,
    stage: state.currentStage,
    seq: Number(state.seq) || 0,
    deviceId: getOfflineDeviceId(),
    takeover: takeover || undefined,
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
  const result = await flushOfflineProgressQueue(bundle);
  return { queued: true, ...result };
}

export async function flushOfflineProgressQueue(bundle) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { pending: loadQueue().length, synced: false };
  }
  let queue = loadQueue();
  if (!queue.length) return { pending: 0, synced: false, syncedOk: false };

  const bases = resolveApiBases(bundle);
  const kept = [];
  let synced = 0;

  for (const item of queue) {
    let ok = false;
    let deviceBound = false;
    let boundHint;
    for (const base of bases) {
      try {
        const url = buildProgressUrl(base, item.event);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => null);
          if (data?.code === 'DEVICE_BOUND') {
            deviceBound = true;
            boundHint = data?.data?.boundDeviceHint;
            break;
          }
        }
        if (res.ok) {
          ok = true;
          synced += 1;
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
        deviceBound: true,
        boundDeviceHint: boundHint,
      };
    }
    if (!ok) kept.push(item);
  }
  saveQueue(kept);
  return { pending: kept.length, synced, syncedOk: synced > 0 };
}

export function offlineBoardPendingCount() {
  return loadQueue().length;
}

/**
 * Fetch / mint Field Terminal device key for Clue 4 (needs brief Wi‑Fi).
 * Patches the in-memory pack clue4 so playData can show the key.
 */
export async function ensureOfflineGridKey(bundle) {
  if (!bundle?.event?.id || !bundle?.team?.teamCode || !bundle?.signingKey) {
    return null;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  let payload = {
    t: 'campus_hunt_offline_grid',
    event: String(bundle.event.id),
    team: bundle.team.teamCode,
    preferredCompletionCode: bundle.clues?.clue4?.answer || '',
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
      const res = await fetch(url, {
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
