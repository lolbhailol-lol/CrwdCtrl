/**
 * Google reCAPTCHA v3 helper.
 *
 * Lazily loads the reCAPTCHA script and returns an action-scoped token that the
 * backend verifies. Completely dormant until VITE_RECAPTCHA_SITE_KEY is set:
 * getRecaptchaToken() then resolves to null, and callers treat null as
 * "no captcha" so every flow keeps working without keys configured.
 */

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

let scriptPromise = null;

function loadScript() {
  if (!SITE_KEY) return Promise.resolve(null);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    if (window.grecaptcha) {
      resolve(window.grecaptcha);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.grecaptcha);
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load reCAPTCHA'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Eagerly load the reCAPTCHA script. No-op when reCAPTCHA is not configured.
 * Safe to call multiple times.
 */
export function preloadRecaptcha() {
  if (!SITE_KEY) return;
  loadScript().catch(() => {});
}

// Number of mounted auth screens currently requesting the badge. Using a
// reference count keeps the badge visible while ANY auth screen is mounted, so
// one screen unmounting (e.g. switching login↔register) can't hide it out from
// under another that is still on-screen.
let badgeRequests = 0;

/**
 * Reveal the reCAPTCHA badge (loading the script if needed). The badge is
 * hidden by default via CSS and only shown while the `recaptcha-visible` class
 * is on <html> — call this when an auth screen mounts.
 */
export function showRecaptchaBadge() {
  if (!SITE_KEY || typeof document === 'undefined') return;
  preloadRecaptcha();
  badgeRequests += 1;
  document.documentElement.classList.add('recaptcha-visible');
}

/**
 * Release a badge request made by showRecaptchaBadge(). The badge only hides
 * once the last auth screen has unmounted (request count reaches zero).
 */
export function hideRecaptchaBadge() {
  if (!SITE_KEY || typeof document === 'undefined') return;
  badgeRequests = Math.max(0, badgeRequests - 1);
  if (badgeRequests === 0) {
    document.documentElement.classList.remove('recaptcha-visible');
  }
}

/**
 * Get a reCAPTCHA v3 token for an action (e.g. 'login', 'register').
 * @param {string} action
 * @returns {Promise<string|null>} token, or null when reCAPTCHA is not configured/unavailable.
 */
export async function getRecaptchaToken(action = 'submit') {
  if (!SITE_KEY) return null;
  try {
    const grecaptcha = await loadScript();
    if (!grecaptcha) return null;
    await new Promise((resolve) => grecaptcha.ready(resolve));
    return await grecaptcha.execute(SITE_KEY, { action });
  } catch (err) {
    console.warn('reCAPTCHA token error:', err?.message || err);
    return null;
  }
}

export const isRecaptchaConfigured = Boolean(SITE_KEY);
