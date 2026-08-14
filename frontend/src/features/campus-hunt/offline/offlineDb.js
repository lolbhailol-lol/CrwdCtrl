/**
 * Offline Event Mode storage facade.
 *
 * Android Capacitor app → encrypted SQLCipher (@capacitor-community/sqlite)
 * Browser / PWA testing → IndexedDB
 *
 * Gameplay never talks to Express, MongoDB, Firebase, or Railway.
 */

import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORES,
} from './constants';
import { isNativeApp } from '../../../utils/capacitorPlatform';
import {
  isSqliteAvailable,
  sqliteAppendPlayLog,
  sqliteDelete,
  sqliteGet,
  sqliteSet,
  sqliteStorageInfo,
} from './sqliteEventStore';

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of Object.values(OFFLINE_STORES)) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open offline database'));
  });
}

async function idbGet(storeName, key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(storeName, key, value) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

function useSqlite() {
  return isNativeApp() && isSqliteAvailable();
}

async function storeGet(storeName, key) {
  if (useSqlite()) {
    try {
      return await sqliteGet(storeName, key);
    } catch {
      return idbGet(storeName, key);
    }
  }
  return idbGet(storeName, key);
}

async function storeSet(storeName, key, value) {
  if (useSqlite()) {
    try {
      return await sqliteSet(storeName, key, value);
    } catch {
      return idbSet(storeName, key, value);
    }
  }
  return idbSet(storeName, key, value);
}

async function storeDelete(storeName, key) {
  if (useSqlite()) {
    try {
      return await sqliteDelete(storeName, key);
    } catch {
      return idbDelete(storeName, key);
    }
  }
  return idbDelete(storeName, key);
}

const BUNDLE_KEY = 'active';

export async function saveOfflineBundle(bundle) {
  if (!bundle?.team?.teamCode) {
    throw new Error('Invalid offline bundle — missing team code');
  }
  await storeSet(OFFLINE_STORES.BUNDLE, BUNDLE_KEY, bundle);
  await appendOfflinePlayLog({
    teamCode: bundle.team.teamCode,
    action: 'bundle_loaded',
    payload: { eventId: bundle.event?.id, team: bundle.team.teamCode },
  });
  return bundle;
}

export async function loadOfflineBundle() {
  return storeGet(OFFLINE_STORES.BUNDLE, BUNDLE_KEY);
}

export async function clearOfflineBundle() {
  return storeDelete(OFFLINE_STORES.BUNDLE, BUNDLE_KEY);
}

export async function saveOfflineTeamState(teamCode, state) {
  await storeSet(OFFLINE_STORES.STATE, String(teamCode), state);
  return state;
}

export async function loadOfflineTeamState(teamCode) {
  return storeGet(OFFLINE_STORES.STATE, String(teamCode));
}

export async function saveOfflineSession(session) {
  await storeSet(OFFLINE_STORES.SESSION, 'current', session);
  return session;
}

export async function loadOfflineSession() {
  return storeGet(OFFLINE_STORES.SESSION, 'current');
}

export async function clearOfflineSession() {
  return storeDelete(OFFLINE_STORES.SESSION, 'current');
}

export async function appendOfflinePlayLog(entry) {
  if (!useSqlite()) return;
  try {
    await sqliteAppendPlayLog(entry);
  } catch {
    /* play log is best-effort */
  }
}

export async function getOfflineStorageInfo() {
  if (useSqlite()) {
    try {
      return await sqliteStorageInfo();
    } catch {
      return { backend: 'browser', encrypted: false, native: true };
    }
  }
  return { backend: 'browser', encrypted: false, native: false };
}

export { createInitialTeamState } from './offlineEngine';
