import { resolveBrowseBackPath } from './categoryHubRoutes';

/**
 * React Router stores the stack index on history.state.idx.
 * history.length is NOT reliable in WhatsApp / Instagram / QR WebViews.
 */
export function canGoBackInApp() {
  if (typeof window === 'undefined') return false;
  const idx = window.history.state?.idx;
  return Number.isInteger(idx) && idx > 0;
}

export function resolveInAppBackFallback(pathname, explicitFallback) {
  if (explicitFallback) return explicitFallback;
  return resolveBrowseBackPath(pathname) || '/';
}

/**
 * In-app Back: previous CrwdCtrl screen when we have history, otherwise the
 * parent listing so shared/scanned links are not a dead end.
 */
export function navigateInAppBack(navigate, fallback = '/') {
  if (typeof navigate !== 'function') return;
  if (canGoBackInApp()) {
    navigate(-1);
    return;
  }
  const target = fallback || '/';
  if (typeof window !== 'undefined') {
    const here = `${window.location.pathname}${window.location.search}`.replace(/\/$/, '') || '/';
    const there = String(target).split('?')[0].replace(/\/$/, '') || '/';
    if (here === there) {
      navigate('/');
      return;
    }
  }
  navigate(target);
}

function isPrivateShellPath(pathname = '') {
  return (
    pathname.startsWith('/admin')
    || pathname.startsWith('/fest-organizer')
    || pathname.startsWith('/trek-organizer')
    || pathname.startsWith('/run-club-organizer')
    || pathname.startsWith('/event-organizer')
    || pathname.startsWith('/event-community-organizer')
    || pathname.startsWith('/organizer')
    || pathname.startsWith('/campus-hunt')
    || pathname.startsWith('/payment/')
  );
}

/**
 * Give WhatsApp / QR / cold-open landings a parent history entry so the
 * browser/OS Back control can leave the page without exiting the WebView.
 * Does not fire popstate, so the current screen stays put.
 */
export function seedDeepLinkHistory(pathname, search = '', hash = '') {
  if (typeof window === 'undefined') return false;
  const path = String(pathname || '') || '/';
  if (path === '/' || path === '/dashboard' || path === '/login' || path === '/register') return false;
  if (isPrivateShellPath(path)) return false;
  if (canGoBackInApp()) return false;

  const fallback = resolveBrowseBackPath(path);
  if (!fallback || fallback === path) return false;

  const current = `${path}${search || ''}${hash || ''}`;
  const state = window.history.state || { usr: null, key: 'default', idx: 0 };
  window.history.replaceState({ ...state, idx: 0, usr: null, key: 'crwd-seed' }, '', fallback);
  window.history.pushState({ ...state, idx: 1 }, '', current);
  return true;
}
