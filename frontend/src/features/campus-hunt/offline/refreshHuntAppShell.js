/**
 * On shared install links: pull the newest service-worker shell when online
 * so leaders get UX fixes without reinstalling the home-screen icon.
 */

const SHELL_BUST_PREFIX = 'ch_hunt_shell_bust_';

export async function purgeHuntAppCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => /workbox|api-cache|crwdctrl|precache|runtime/i.test(k))
        .map((k) => caches.delete(k)),
    );
  } catch { /* ignore */ }
}

export async function refreshHuntAppShell() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { checked: false, waiting: false };
  }
  try {
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
 * Once per install token (per tab session): bump SW, purge caches, reload
 * so a new pack link never keeps the old Round 1 / Survival / Finale shell.
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

  // No waiting worker — still hard-reload once so precache picks up new assets.
  const url = new URL(window.location.href);
  if (!url.searchParams.has('_hunt')) {
    url.searchParams.set('_hunt', String(Date.now()));
    window.location.replace(url.toString());
    return { reloaded: true, waiting: false };
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
