import {
  getPendingPayment,
  hasCashfreeReturnParams,
  hasPaymentReturnExpected,
  isStalePendingPayment,
  pathsMatchPendingReturn,
} from './deepLinks';
import { isHomeHubPath } from './homeShellReady';

/** Skip splash when returning from Cashfree — resume payment immediately */
function hasPaymentReturnContext() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.location.pathname === '/payment/return') return true;
    if (hasCashfreeReturnParams(window.location.search)) return true;
    // Only treat as a payment return when we have an explicit return signal —
    // a lingering pending order alone must NOT skip the splash on normal visits.
    const pending = getPendingPayment();
    if (hasPaymentReturnExpected() && pending?.orderId && !isStalePendingPayment(pending)) {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (pathsMatchPendingReturn(pending.returnPath, currentPath)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Shared fest/trek/club/event links — skip branded logo splash so the content
 * page paints immediately (WhatsApp / Instagram / copied links).
 */
export function isSharedContentDeepLink(pathname = '') {
  const path = String(pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '');
  return (
    /^\/trek(\/|$)/.test(path)
    || /^\/treks\/community(\/|$)/.test(path)
    || /^\/view-details(\/|$)/.test(path)
    || /^\/competitions-view-details(\/|$)/.test(path)
    || /^\/competition(\/|$)/.test(path)
    || /^\/stall(\/|$)/.test(path)
    || /^\/s(\/|$)/.test(path)
    || /^\/sports\/run(\/|$)/.test(path)
    || /^\/sports\/run-club(\/|$)/.test(path)
    || /^\/events\/[^/]+/.test(path)
    || /^\/campus-hunt(\/|$)/.test(path)
    || /^\/campus-hunt-volunteer(\/|$)/.test(path)
  );
}

/** Google / Bing search opens — HTML splash stacks on the React 3D loader and looks stuck. */
export function isSearchEngineEntry() {
  try {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/Googlebot|Google-InspectionTool|AdsBot-Google|DuplexWeb-Google|GSA\/|GoogleApp/i.test(ua)) {
      return true;
    }
    const ref = document.referrer || '';
    if (/google\.(com|co\.|com\.)|bing\.com|duckduckgo\.com|yahoo\.com/i.test(ref)) {
      return true;
    }
    const params = new URLSearchParams(window.location.search || '');
    if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) return true;
    const utm = String(params.get('utm_source') || '').toLowerCase();
    if (utm === 'google' || utm === 'bing' || utm === 'organic') return true;
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
 * Shared fest/competition WhatsApp links get a very short logo, then the page.
 * Instagram still skips splash (it can stick as a black screen).
 */
export function shouldShowBootSplash() {
  try {
    if (hasAuthCallbackParams()) return false;
    if (hasPaymentReturnContext()) return false;

    try {
      if (typeof document !== 'undefined' && document.documentElement.classList.contains('skip-boot-splash')) {
        return false;
      }
    } catch { /* ignore */ }

    try {
      const ua = navigator.userAgent || '';
      // In-app browsers stick on the HTML splash — skip like Instagram
      if (/Instagram|FBAN|FBAV|FB_IAB|Messenger|WhatsApp|Line\/|Telegram|Twitter|LinkedInApp|Snapchat|Pinterest|TikTok|BytedanceWebview|MicroMessenger/i.test(ua)) {
        return false;
      }
    } catch { /* ignore */ }

    if (isSearchEngineEntry()) return false;

    const path = window.location.pathname || '';
    // Home hub + detail pages already show a React 3D loader — a second splash sticks/flashes
    if (isHomeHubPath(path) || isSharedContentDeepLink(path)) return false;

    const [nav] = performance.getEntriesByType?.('navigation') ?? [];
    const isBackForward = nav?.type === 'back_forward' || performance.navigation?.type === 2;

    if (/^\/campus-hunt(\/|$)/.test(path)
      || /^\/campus-hunt-volunteer(\/|$)/.test(path)) {
      return false;
    }

    if (isBackForward) return false;
    if (nav?.type === 'reload' || nav?.type === 'navigate') return true;

    const legacyType = performance.navigation?.type;
    if (legacyType === 0 || legacyType === 1) return true;

    return true;
  } catch {
    return true;
  }
}

export function isShortBootSplash() {
  try {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('short-boot-splash')) {
      return true;
    }
    return isSharedContentDeepLink();
  } catch {
    return false;
  }
}

export function removeHtmlBootSplash() {
  const el = document.getElementById('boot-splash');
  if (!el) return;
  if (document.documentElement.classList.contains('skip-boot-splash')) {
    el.remove();
    return;
  }
  if (el.dataset.removing === '1') return;
  el.dataset.removing = '1';
  el.classList.add('boot-splash-out');
  const fade = isShortBootSplash() ? BOOT_SPLASH_SHORT_FADE_MS : BOOT_SPLASH_FADE_MS;
  const remove = () => el.remove();
  el.addEventListener('transitionend', remove, { once: true });
  window.setTimeout(remove, fade + 80);
}

/** Total splash cycle — assemble, brief hold, fade (~1.9s) */
export const BOOT_SPLASH_TOTAL_MS = 1900;
export const BOOT_SPLASH_FADE_MS = 320;
/** WhatsApp / shared fest links — tiny logo then the page */
export const BOOT_SPLASH_SHORT_MS = 380;
export const BOOT_SPLASH_SHORT_FADE_MS = 180;
export const BOOT_SPLASH_SHORT_MAX_MS = 1100;
/** When fade-out starts and main app appears */
export const BOOT_SPLASH_MS = BOOT_SPLASH_TOTAL_MS - BOOT_SPLASH_FADE_MS;

/** Matches DarkModeProvider / index.html inline theme script */
export function getBootSplashIsDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function signalDetailPageReady() {
  try {
    window.dispatchEvent(new Event('crwdctrl:detail-ready'));
  } catch {
    /* ignore */
  }
  removeHtmlBootSplash();
}
