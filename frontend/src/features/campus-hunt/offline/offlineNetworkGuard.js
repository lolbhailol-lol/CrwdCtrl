/**
 * During Offline Event Mode gameplay, block REST / Firebase / Railway calls.
 * Static chunks and same-origin assets still load (needed after a refresh).
 */

const BLOCK = /\/api\/|railway\.app|firestore\.googleapis|identitytoolkit|securetoken\.google|fcm\.googleapis|firebaseio\.com|crashlytics/i;

let armed = false;
let originalFetch = null;

export function isOfflineEventRoute(pathname = window.location?.pathname || '') {
  return String(pathname).startsWith('/campus-hunt/offline');
}

export function armOfflineNetworkGuard() {
  if (armed || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return () => {};
  }
  originalFetch = window.fetch.bind(window);
  armed = true;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (BLOCK.test(String(url))) {
      const err = new Error('Offline Event Mode: gameplay does not use the network');
      err.code = 'OFFLINE_EVENT_MODE';
      return Promise.reject(err);
    }
    return originalFetch(input, init);
  };
  return disarmOfflineNetworkGuard;
}

export function disarmOfflineNetworkGuard() {
  if (!armed || !originalFetch) return;
  window.fetch = originalFetch;
  originalFetch = null;
  armed = false;
}
