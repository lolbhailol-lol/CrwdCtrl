import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { isNativeApp } from './capacitorPlatform';
import { pathFromAppUrl } from './deepLinks';
import { openExternalUrl } from './externalLink';

/**
 * Initialize Capacitor native behaviors: splash, status bar, back button, deep links.
 */
export async function initCapacitorApp({ navigate, onBack, onBackWhenRoot }) {
  if (!isNativeApp()) return () => {};

  const cleanups = [];

  try {
    await SplashScreen.hide();
  } catch {
    /* optional */
  }

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#161718' });
  } catch {
    /* optional */
  }

  try {
    Keyboard.setAccessoryBarVisible({ isVisible: true });
  } catch {
    /* optional */
  }

  const backHandle = await App.addListener('backButton', ({ canGoBack }) => {
    // Prefer browse-flow targets (fest → fests → home) over raw history
    if (typeof onBack === 'function' && onBack()) {
      return;
    }
    if (canGoBack) {
      window.history.back();
    } else if (typeof onBackWhenRoot === 'function') {
      onBackWhenRoot();
    } else {
      App.exitApp();
    }
  });
  cleanups.push(() => backHandle.remove());

  const urlHandle = await App.addListener('appUrlOpen', (event) => {
    const path = pathFromAppUrl(event.url);
    if (path && navigate) {
      navigate(path);
    }
  });
  cleanups.push(() => urlHandle.remove());

  // Open external links (Instagram, social, website, maps, etc.) in the system
  // browser. Inside the WebView, <a target="_blank"> and external hrefs are a
  // no-op, so intercept them here and route through @capacitor/browser.
  const onLinkClick = (event) => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return; // let mailto/tel/internal routes pass through

    let isExternal = true;
    try {
      isExternal = new URL(href, window.location.href).origin !== window.location.origin;
    } catch {
      isExternal = true;
    }

    if (isExternal || anchor.target === '_blank') {
      event.preventDefault();
      openExternalUrl(href);
    }
  };
  document.addEventListener('click', onLinkClick, true);
  cleanups.push(() => document.removeEventListener('click', onLinkClick, true));

  return () => cleanups.forEach((fn) => fn());
}
