import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function isAndroid() {
  return Capacitor.getPlatform() === 'android';
}

export function isIOS() {
  return Capacitor.getPlatform() === 'ios';
}

export function getPlatform() {
  return Capacitor.getPlatform();
}

/** Mobile browsers + Capacitor should use redirect checkout, not modal. */
export function prefersRedirectCheckout() {
  if (isNativeApp()) return true;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Local dev: modal avoids redirect + stale pending verify loops on localhost
    if (host === 'localhost' || host === '127.0.0.1') return false;
  }
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(ua);
}
