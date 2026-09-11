import { Capacitor } from '@capacitor/core';
import { isInAppBrowser } from '../config/apiBase';

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

/**
 * Mobile browsers + Capacitor should use redirect checkout, not modal.
 * Redirect lets Cashfree hand off to PhonePe / GPay / Paytm UPI apps;
 * modal checkout often cannot open those apps (especially in Instagram/FB).
 */
export function prefersRedirectCheckout() {
  if (isNativeApp()) return true;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Local dev: modal avoids redirect + stale pending verify loops on localhost
    if (host === 'localhost' || host === '127.0.0.1') return false;
  }
  if (typeof navigator === 'undefined') return false;
  if (isInAppBrowser()) return true;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(ua);
}
