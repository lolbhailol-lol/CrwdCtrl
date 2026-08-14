import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORES,
} from './constants';

function openOfflineDb() {
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
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(storeName, key, value) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

const BUNDLE_KEY = 'active';

export async function saveOfflineBundle(bundle) {
  if (!bundle?.team?.teamCode) {
    throw new Error('Invalid offline bundle — missing team code');
  }
  await idbSet(OFFLINE_STORES.BUNDLE, BUNDLE_KEY, bundle);
  return bundle;
}

export async function loadOfflineBundle() {
  return idbGet(OFFLINE_STORES.BUNDLE, BUNDLE_KEY);
}

export async function clearOfflineBundle() {
  return idbDelete(OFFLINE_STORES.BUNDLE, BUNDLE_KEY);
}

export async function saveOfflineTeamState(teamCode, state) {
  await idbSet(OFFLINE_STORES.STATE, String(teamCode), state);
  return state;
}

export async function loadOfflineTeamState(teamCode) {
  return idbGet(OFFLINE_STORES.STATE, String(teamCode));
}

export async function saveOfflineSession(session) {
  await idbSet(OFFLINE_STORES.SESSION, 'current', session);
  return session;
}

export async function loadOfflineSession() {
  return idbGet(OFFLINE_STORES.SESSION, 'current');
}

export async function clearOfflineSession() {
  return idbDelete(OFFLINE_STORES.SESSION, 'current');
}

export function createInitialTeamState(bundle) {
  const startingScore = Number(bundle?.event?.startingScore) > 0
    ? Number(bundle.event.startingScore)
    : 100;
  return {
    teamCode: bundle.team.teamCode,
    currentStage: 'CLUE1_ACTIVE',
    score: startingScore,
    penalties: [],
    clueProgress: {
      clue1: { solved: false, attempts: 0 },
      clue2: { solved: false, attempts: 0 },
      clue3: { solved: false, attempts: 0 },
      clue4: { solved: false, attempts: 0 },
      clue5: { solved: false, attempts: 0 },
    },
    checkpointScans: {},
    memberProofs: {},
    updatedAt: new Date().toISOString(),
  };
}
