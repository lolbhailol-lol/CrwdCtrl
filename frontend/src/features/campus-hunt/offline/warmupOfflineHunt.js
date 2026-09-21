import { CAMPUS_HUNT_PATHS } from '../config';

const HUNT_SHELL_PATHS = [
  CAMPUS_HUNT_PATHS.offline,
  CAMPUS_HUNT_PATHS.offlineLogin,
  CAMPUS_HUNT_PATHS.offlineTeam,
  CAMPUS_HUNT_PATHS.offlineRounds,
  CAMPUS_HUNT_PATHS.offlinePlay,
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

/**
 * Precache Hunt screens + wait for the service worker so airplane mode
 * can open the home-screen icon. Call after pack save while still online.
 */
export async function warmupOfflineHunt({ timeoutMs = 12000 } = {}) {
  const imports = Promise.allSettled([
    import('./pages/OfflineHuntLandingPage'),
    import('./pages/OfflineHuntLoginPage'),
    import('./pages/OfflineHuntTeamPage'),
    import('./pages/OfflineHuntRoundsPage'),
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

  // Touch shell routes so navigateFallback + runtime cache are warm.
  const pages = Promise.allSettled(
    HUNT_SHELL_PATHS.map((path) => fetch(path, { credentials: 'same-origin', cache: 'reload' }).catch(() => null)),
  );

  await withTimeout(Promise.all([imports, swReady, pages]), timeoutMs);

  // Second pass without cache:reload — confirm SW can serve while "online".
  await withTimeout(
    Promise.allSettled(
      HUNT_SHELL_PATHS.slice(0, 5).map((path) => fetch(path, { credentials: 'same-origin' }).catch(() => null)),
    ),
    4000,
  );

  return true;
}
