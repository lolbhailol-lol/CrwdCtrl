/**
 * On shared install links: pull the newest service-worker shell when online
 * so leaders get UX fixes without reinstalling the home-screen icon.
 *
 * NEVER delete workbox/precache caches — that breaks airplane-mode Hunt.
 */

const SHELL_BUST_PREFIX = 'ch_hunt_shell_bust_v22_';

/** Soft clear only API / transient caches. Keep precache for offline play. */
export async function purgeHuntAppCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => /api-cache/i.test(k) && !/precache/i.test(k))
        .map((k) => caches.delete(k)),
    );
  } catch { /* ignore */ }
}

export async function refreshHuntAppShell() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { checked: false, waiting: false };
  }
  try {
    // Do not wipe precache — airplane mode needs it.
    await purgeHuntAppCaches();
    const regs = await navigator.serviceWorker.getRegistrations();
    let waiting = false;
    await Promise.all(
      regs.map(async (reg) => {
        try {
          await reg.update();
        } catch { /* ignore */ }
        if (reg.waiting) waiting = true;
      }),
    );
    return { checked: true, waiting };
  } catch {
    return { checked: false, waiting: false };
  }
}

/**
 * Once per install token: activate a waiting SW if present.
 * Does not delete precache or force a blind reload (that emptied the offline shell).
 */
export async function bustStaleHuntShellOnce(token) {
  if (typeof window === 'undefined') return { reloaded: false, waiting: false };
  const key = `${SHELL_BUST_PREFIX}${String(token || '').slice(0, 48)}`;
  try {
    if (sessionStorage.getItem(key) === '1') {
      return { reloaded: false, waiting: false, already: true };
    }
    sessionStorage.setItem(key, '1');
  } catch { /* private mode */ }

  const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
  if (shell?.waiting) {
    await applyWaitingHuntUpdate();
    return { reloaded: true, waiting: true };
  }
  return { reloaded: false, waiting: false };
}

/** Activate a waiting SW, then reload once — only call from an explicit user tap. */
export async function applyWaitingHuntUpdate() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  let activated = false;
  for (const reg of regs) {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      activated = true;
    }
  }
  if (activated) {
    window.setTimeout(() => {
      window.location.reload();
    }, 400);
  }
  return activated;
}
