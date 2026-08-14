import { CAMPUS_HUNT_PATHS } from '../config';

const HUNT_SHELL_PATHS = [
  CAMPUS_HUNT_PATHS.offline,
  CAMPUS_HUNT_PATHS.offlineLogin,
  CAMPUS_HUNT_PATHS.offlineTeam,
  CAMPUS_HUNT_PATHS.offlineRounds,
  CAMPUS_HUNT_PATHS.offlinePlay,
  '/offline-hunt.webmanifest',
];

/**
 * Precache Hunt screens + wait for the service worker so airplane mode
 * can open the home-screen icon without hitting the network.
 */
export async function warmupOfflineHunt() {
  const imports = Promise.allSettled([
    import('./pages/OfflineHuntLandingPage'),
    import('./pages/OfflineHuntLoginPage'),
    import('./pages/OfflineHuntTeamPage'),
    import('./pages/OfflineHuntRoundsPage'),
    import('./pages/OfflineHuntPlayPage'),
    import('../player/PlayerPlayScreen'),
  ]);

  const swReady = (typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
    ? navigator.serviceWorker.ready.catch(() => null)
    : Promise.resolve(null);

  const pages = Promise.allSettled(
    HUNT_SHELL_PATHS.map((path) => fetch(path, { credentials: 'same-origin' })),
  );

  await Promise.all([imports, swReady, pages]);
}
