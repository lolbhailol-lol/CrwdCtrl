const DB_NAME = 'ctrl_mystery_offline';
const DB_VERSION = 1;
const STATE_STORE = 'investigation_state';
const QUEUE_STORE = 'action_queue';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: 'teamId' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result?.result ?? result);
    tx.onerror = () => reject(tx.error);
  });
}

/** Cache the latest investigation-state snapshot for offline viewing. */
export async function cacheInvestigationState(teamId, state) {
  try {
    await withStore(STATE_STORE, 'readwrite', (store) => {
      store.put({ teamId, state, savedAt: Date.now() });
    });
  } catch {
    // Browser storage can fail (private mode, quota) — never block the UI for this.
  }
}

export async function readCachedInvestigationState(teamId) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STATE_STORE, 'readonly');
      const req = tx.objectStore(STATE_STORE).get(teamId);
      req.onsuccess = () => resolve(req.result?.state || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Queue an action taken while offline — flushed in order once back online. */
export async function enqueueOfflineAction(teamId, action) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const req = tx.objectStore(QUEUE_STORE).add({ teamId, ...action, queuedAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function readQueuedActions(teamId) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).filter((a) => a.teamId === teamId));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeQueuedAction(id) {
  try {
    await withStore(QUEUE_STORE, 'readwrite', (store) => store.delete(id));
  } catch {
    // best-effort
  }
}