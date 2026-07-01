import {
  getPendingPayment,
  hasCashfreeReturnParams,
  hasPaymentReturnExpected,
  isStalePendingPayment,
  pathsMatchPendingReturn,
} from './deepLinks';

/** Skip splash when returning from Cashfree — resume payment immediately */
function hasPaymentReturnContext() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.location.pathname === '/payment/return') return true;
    if (hasCashfreeReturnParams(window.location.search)) return true;
    const pending = getPendingPayment();
    if (pending?.orderId && !isStalePendingPayment(pending)) {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (pathsMatchPendingReturn(pending.returnPath, currentPath)) return true;
    }
    if (hasPaymentReturnExpected() && pending) return true;
    return false;
  } catch {
    return false;
  }
}

/** Skip splash during OAuth / email verification returns */
export function hasAuthCallbackParams() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';

    // Firebase email verification / password reset
    if (urlParams.has('oobCode') || urlParams.has('mode')) return true;

    // Firebase auth handler redirect (mobile OAuth)
    if (urlParams.has('apiKey') && (urlParams.has('state') || urlParams.has('code'))) return true;

    // Implicit OAuth tokens in hash
    if (hash.includes('access_token') || hash.includes('id_token')) return true;

    // OAuth2 authorization code — require both params (avoid false positives from ?state= UTM links)
    if (urlParams.has('code') && urlParams.has('state')) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Show branded splash on first open (navigate) and refresh — not on back/forward.
 */
export function shouldShowBootSplash() {
  try {
    if (hasAuthCallbackParams()) return false;
    if (hasPaymentReturnContext()) return false;

    const [nav] = performance.getEntriesByType?.('navigation') ?? [];
    if (nav?.type === 'reload' || nav?.type === 'navigate') return true;
    if (nav?.type === 'back_forward') return false;

    const legacyType = performance.navigation?.type;
    if (legacyType === 0 || legacyType === 1) return true;

    return true;
  } catch {
    return true;
  }
}

export function removeHtmlBootSplash() {
  const el = document.getElementById('boot-splash');
  if (!el || el.dataset.removing === '1') return;
  el.dataset.removing = '1';
  el.classList.add('boot-splash-out');
  const remove = () => el.remove();
  el.addEventListener('transitionend', remove, { once: true });
  window.setTimeout(remove, BOOT_SPLASH_FADE_MS + 80);
}

/** Total splash cycle — assemble, brief hold, fade (~1.9s) */
export const BOOT_SPLASH_TOTAL_MS = 1900;
export const BOOT_SPLASH_FADE_MS = 320;
/** When fade-out starts and main app appears */
export const BOOT_SPLASH_MS = BOOT_SPLASH_TOTAL_MS - BOOT_SPLASH_FADE_MS;

/** Matches DarkModeProvider / index.html inline theme script */
export function getBootSplashIsDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}
