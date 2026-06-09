import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { isNativeApp } from './capacitorPlatform';
import { pathFromAppUrl } from './deepLinks';

/**
 * Initialize Capacitor native behaviors: splash, status bar, back button, deep links.
 */
export async function initCapacitorApp({ navigate, onBackWhenRoot }) {
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

  return () => cleanups.forEach((fn) => fn());
}
