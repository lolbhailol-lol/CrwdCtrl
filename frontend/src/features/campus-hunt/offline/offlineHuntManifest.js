/**
 * Point Chrome/Android install at the Hunt PWA, not the main CrwdCtrl website.
 * Must run as early as possible (also mirrored in index.html).
 */

const HUNT_MANIFEST = '/offline-hunt.webmanifest';
const MAIN_MANIFEST = '/manifest.webmanifest';

export function isOfflineHuntPath(pathname = window.location?.pathname || '') {
  return String(pathname).startsWith('/campus-hunt/offline');
}

export function applyOfflineHuntManifest() {
  if (typeof document === 'undefined') return;
  const href = isOfflineHuntPath() ? HUNT_MANIFEST : null;
  const links = document.querySelectorAll('link[rel="manifest"]');
  if (!href) {
    links.forEach((el) => {
      if (el.getAttribute('href') === HUNT_MANIFEST) {
        el.setAttribute('href', MAIN_MANIFEST);
      }
    });
    return;
  }
  if (links.length) {
    links.forEach((el) => el.setAttribute('href', href));
  } else {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = href;
    document.head.appendChild(link);
  }
  let apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!apple) {
    apple = document.createElement('meta');
    apple.setAttribute('name', 'apple-mobile-web-app-title');
    document.head.appendChild(apple);
  }
  apple.setAttribute('content', 'Hunt');
}
