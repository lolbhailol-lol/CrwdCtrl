import { CAMPUS_HUNT_PATHS } from '../config';

const HUNT_SHELL_PATHS = [
  CAMPUS_HUNT_PATHS.offline,
  CAMPUS_HUNT_PATHS.offlineLogin,
  CAMPUS_HUNT_PATHS.offlinePlay,
  CAMPUS_HUNT_PATHS.offlineRounds,
  '/offline-hunt.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

/** Activate any waiting SW so the new shell (no Survival hub) controls this tab. */
async function activateWaitingServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    let activated = false;
    for (const reg of regs) {
      try {
        await reg.update();
      } catch { /* ignore */ }
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        activated = true;
      }
    }
    return activated;
  } catch {
    return false;
  }
}

/**
 * Precache Hunt screens + wait for the service worker so airplane mode
 * works as soon as the pack is saved. Call after pack save while still online.
 */
export async function warmupOfflineHunt({ timeoutMs = 16000 } = {}) {
  // Eager imports already ship with the main offline chunk; still touch them.
  const imports = Promise.allSettled([
    import('./pages/OfflineHuntLandingPage'),
    import('./pages/OfflineHuntLoginPage'),
    import('./pages/OfflineHuntPlayPage'),
    import('./pages/OfflineHuntInstallPage'),
    import('../player/PlayerPlayScreen'),
    import('./components/OfflineHuntInstallHelp'),
    import('./components/OfflineHuntBriefing'),
    import('./components/OfflineHuntWelcome'),
  ]);

  const swReady = (typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
    ? navigator.serviceWorker.ready.catch(() => null)
    : Promise.resolve(null);

  const pages = Promise.allSettled(
    HUNT_SHELL_PATHS.map((path) => fetch(path, { credentials: 'same-origin', cache: 'reload' }).catch(() => null)),
  );

  await withTimeout(Promise.all([imports, swReady, pages]), timeoutMs);
  await activateWaitingServiceWorker();

  // Confirm SW can serve shell routes without network.
  await withTimeout(
    Promise.allSettled(
      HUNT_SHELL_PATHS.slice(0, 3).map((path) => fetch(path, { credentials: 'same-origin' }).catch(() => null)),
    ),
    5000,
  );

  return true;
}
