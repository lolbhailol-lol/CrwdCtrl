/**
 * Best-effort live board sync — never blocks play.
 */

import { OFFLINE_STORES } from './constants';

const QUEUE_KEY = 'progress_queue';
const DEVICE_KEY = 'device_id';

function apiBase(bundle) {
  const fromBundle = String(bundle?.event?.apiBase || '').replace(/\/$/, '');
  if (fromBundle) return fromBundle;
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Same-origin proxy or Vite env
    return import.meta.env?.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
  }
  return '';
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

async function signProgress(bundle, payload) {
  const key = bundle.signingKey;
  const { sig: _s, ...rest } = payload;
  const body = JSON.stringify(rest);
  // Prefer Web Crypto HMAC when available; fallback to embedding unsigned for queue retry with precomputed sig from offlineQr helper
  if (typeof crypto !== 'undefined' && crypto.subtle && key) {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(body));
    const hex = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 20);
  }
  return '';
}

export async function enqueueOfflineProgress(bundle, state) {
  if (!bundle?.event?.id || !bundle?.team?.teamCode) return { queued: false };
  const takeover = consumeTakeoverFlag();
  const payload = {
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
    payload.sig = await signProgress(bundle, payload);
  } catch {
    payload.sig = '';
  }
  const queue = loadQueue();
  queue.push(payload);
  saveQueue(queue);
  const result = await flushOfflineProgressQueue(bundle);
  return { queued: true, ...result };
}

export async function flushOfflineProgressQueue(bundle) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { pending: loadQueue().length, synced: false };
  }
  const base = apiBase(bundle);
  if (!base && typeof window === 'undefined') {
    return { pending: loadQueue().length, synced: false };
  }
  const origin = base || (typeof window !== 'undefined' ? '' : '');
  let queue = loadQueue();
  const kept = [];
  let synced = 0;
  for (const item of queue) {
    try {
      const url = `${origin}/api/campus-hunt/events/${item.event}/offline-progress`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        if (data?.code === 'DEVICE_BOUND') {
          const rest = queue.slice(queue.indexOf(item));
          saveQueue(rest);
          return {
            pending: rest.length,
            synced: false,
            deviceBound: true,
            boundDeviceHint: data?.data?.boundDeviceHint,
          };
        }
      }
      if (!res.ok) {
        kept.push(item);
        continue;
      }
      synced += 1;
    } catch {
      kept.push(item);
    }
  }
  saveQueue(kept);
  return { pending: kept.length, synced, syncedOk: synced > 0 };
}

export function offlineBoardPendingCount() {
  return loadQueue().length;
}
