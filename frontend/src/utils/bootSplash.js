import {
  getPendingPayment,
  hasCashfreeReturnParams,
  hasPaymentReturnExpected,
} from './deepLinks';

/** Skip splash when returning from Cashfree — resume payment immediately */
function hasPaymentReturnContext() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.location.pathname === '/payment/return') return true;
    if (hasCashfreeReturnParams(window.location.search)) return true;
    if (hasPaymentReturnExpected() && getPendingPayment()) return true;
    return false;
  } catch {
    return false;
  }
}

/** Skip splash during OAuth / email verification returns */
function hasAuthCallbackParams() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return (
      urlParams.has('apiKey') ||
      urlParams.has('oobCode') ||
      window.location.hash.includes('access_token') ||
      urlParams.has('state') ||
      urlParams.has('code')
    );
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
  window.setTimeout(remove, 320);
}

/** Brief branded moment — HTML splash handles visuals; React only holds the timer */
export const BOOT_SPLASH_MS = 320;
