/** Top-level category hub routes — home chip in search row, no bottom nav. */
export const CATEGORY_HUB_PATHS = ['/fests', '/sports', '/treks', '/events'];

export function isCategoryHubRoute(pathname = '') {
  return CATEGORY_HUB_PATHS.includes(pathname);
}

function cleanPath(pathname = '') {
  const path = String(pathname || '').split('?')[0];
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

function dropLastSegment(path) {
  const parts = cleanPath(path).split('/').filter(Boolean);
  if (parts.length < 2) return '/';
  return `/${parts.slice(0, -1).join('/')}`;
}

/**
 * Deterministic back targets for student browse flow.
 * Shared / WhatsApp / QR landings have no in-app history — send them to the
 * parent listing (or home) instead of a dead Back button.
 * Returns null for admin/organizer shells so those keep their own back.
 */
export function resolveBrowseBackPath(pathname = '') {
  const path = cleanPath(pathname);

  if (
    path.startsWith('/admin')
    || path.startsWith('/fest-organizer')
    || path.startsWith('/trek-organizer')
    || path.startsWith('/run-club-organizer')
    || path.startsWith('/event-organizer')
    || path.startsWith('/event-community-organizer')
    || path.startsWith('/organizer')
    || path.startsWith('/campus-hunt')
    || path.startsWith('/campus-hunt-volunteer')
  ) {
    return null;
  }

  if (path.endsWith('/book') || path.endsWith('/register')) {
    const parent = dropLastSegment(path);
    if (parent.startsWith('/fest/')) {
      const festId = parent.split('/')[2];
      return festId ? `/view-details/${festId}` : '/fests';
    }
    return parent !== '/' ? parent : '/';
  }

  if (path.startsWith('/view-details')) return '/fests';
  if (path === '/cultural-fest' || path === '/tech-fest' || path === '/sports-fest') return '/fests';
  if (path.startsWith('/competition-list/')) {
    const festId = path.split('/')[2];
    return festId ? `/view-details/${festId}` : '/fests';
  }
  if (
    path.startsWith('/competitions-view-details')
    || path.startsWith('/competition-register')
    || path.startsWith('/competition-registration')
  ) {
    return '/fests';
  }

  if (path.startsWith('/sports/run-club/')) return '/sports';
  if (path.startsWith('/sports/run/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 3) return `/${parts.slice(0, 3).join('/')}`;
    return '/sports';
  }
  if (path.startsWith('/trek/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 2) return `/${parts.slice(0, 2).join('/')}`;
    return '/treks';
  }
  if (path.startsWith('/treks/community/') || path.startsWith('/treks/category/')) return '/treks';

  if (path.startsWith('/events/community-event/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 3) return `/${parts.slice(0, 3).join('/')}`;
    return '/events';
  }
  if (path.startsWith('/events/community/')) return '/events';
  if (path.startsWith('/events/') && path !== '/events') return '/events';

  if (
    path.startsWith('/qr-ticket')
    || path.startsWith('/registration-details')
    || path.startsWith('/payment-invoice')
  ) {
    return '/booking';
  }

  if (isCategoryHubRoute(path) || path === '/login' || path === '/register') return '/';

  if (path === '/' || path === '/dashboard') return null;

  return '/';
}
