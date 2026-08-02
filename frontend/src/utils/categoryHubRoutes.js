/** Top-level category hub routes — home chip in search row, no bottom nav. */
export const CATEGORY_HUB_PATHS = ['/fests', '/sports', '/treks', '/events'];

export function isCategoryHubRoute(pathname = '') {
  return CATEGORY_HUB_PATHS.includes(pathname);
}

/**
 * Deterministic back targets for student browse flow:
 * fest detail → fests hub → home (and similar for other categories).
 * Returns null when the OS/history back should handle it.
 */
export function resolveBrowseBackPath(pathname = '') {
  const path = String(pathname || '').split('?')[0];

  if (path.startsWith('/view-details')) return '/fests';
  if (path === '/cultural-fest' || path === '/tech-fest' || path === '/sports-fest') return '/fests';
  if (path.startsWith('/competitions-view-details') || path.startsWith('/competition')) {
    return '/fests';
  }

  if (path.startsWith('/sports/run') || path.startsWith('/sports/run-club')) return '/sports';
  if (path.startsWith('/trek/') || path.startsWith('/treks/community/')) return '/treks';
  if (path.startsWith('/events/') && path !== '/events') return '/events';

  if (isCategoryHubRoute(path)) return '/';

  return null;
}
