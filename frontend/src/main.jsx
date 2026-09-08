import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { shouldShowBootSplash, removeHtmlBootSplash, BOOT_SPLASH_TOTAL_MS, BOOT_SPLASH_SHORT_MAX_MS, isShortBootSplash, hasAuthCallbackParams } from './utils/bootSplash'
import { clearOAuthRedirectMarkers } from './utils/authBootstrap'
import { initThemeClass } from './utils/themeInit'
import { initSentry } from './utils/sentry'
import { isNativeApp } from './utils/capacitorPlatform'
import { initCashfreeNativeGateway } from './utils/bootstrapCashfreeNative'
import { initGlobalErrorHandlers } from './utils/chunkError'
import { dismissBootOverlays } from './utils/dismissBootOverlays'
import { isSafariBrowser } from './utils/safariBrowser'
import { preloadCategoryNavIcons } from './constants/categoryNavIcons'
import { isInAppBrowser } from './config/apiBase'
import { isSharedContentDeepLink } from './utils/bootSplash'
import { SpeedInsights } from '@vercel/speed-insights/react'

initThemeClass()
initSentry()
initGlobalErrorHandlers()
// Warm current-theme nav icons only (no <link rel=preload> — avoids unused-preload warnings on event pages)
try {
  const isDark = document.documentElement.classList.contains('dark')
  preloadCategoryNavIcons(isDark)
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200))
  idle(() => preloadCategoryNavIcons(!isDark))
} catch {
  /* ignore */
}

// Stale OAuth markers make the app show the loading logo forever
if (!hasAuthCallbackParams()) {
  clearOAuthRedirectMarkers()
}

if (isNativeApp()) {
  initCashfreeNativeGateway().catch(() => {})
}

// OAuth / email flows — skip static HTML splash immediately
if (!shouldShowBootSplash()) {
  removeHtmlBootSplash()
} else {
  const safety = (isShortBootSplash() ? BOOT_SPLASH_SHORT_MAX_MS : BOOT_SPLASH_TOTAL_MS) + 400
  window.setTimeout(removeHtmlBootSplash, safety)
}

// PWA service worker — web only (not Capacitor native shell).
// NEVER auto-reload on SW update: onNeedRefresh + controllerchange caused infinite
// reload loops (WhatsApp / Chrome stuck on “Loading event…” forever after deploys).
if (import.meta.env.PROD && !isNativeApp() && 'serviceWorker' in navigator) {
  const deepLink = (() => {
    try {
      return isSharedContentDeepLink(window.location.pathname || '');
    } catch {
      return false;
    }
  })();
  const inApp = isInAppBrowser();

  // Shared / in-app opens: drop controlling SW so stale caches can't block the page
  if (deepLink || inApp) {
    navigator.serviceWorker.getRegistrations?.()
      .then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {});
        });
      })
      .catch(() => {});
    if ('caches' in window) {
      caches.keys()
        .then((keys) => keys.filter((k) => /workbox|api-cache|crwdctrl/i.test(k)).forEach((k) => caches.delete(k)))
        .catch(() => {});
    }
  } else {
    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          // Stay on current page — user gets the new SW on next cold open
        },
        onRegisteredSW(_swUrl, registration) {
          if (!('caches' in window)) return;
          caches.keys().then((keys) => {
            keys
              .filter((key) => /api-cache/i.test(key))
              .forEach((key) => caches.delete(key));
          }).catch(() => {});
          // Opportunistically clear obsolete firebase messaging SW
          navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
            registrations.forEach((reg) => {
              const scriptUrl = String(
                reg.active?.scriptURL
                || reg.waiting?.scriptURL
                || reg.installing?.scriptURL
                || '',
              );
              if (scriptUrl.includes('firebase-messaging-sw.js')) {
                reg.unregister().catch(() => {});
              }
            });
          }).catch(() => {});
          return registration;
        },
      });
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')).render(
  import.meta.env.PROD ? (
    <ErrorBoundary>
      <App />
      {!isNativeApp() && !isSafariBrowser() && <SpeedInsights />}
    </ErrorBoundary>
  ) : (
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  ),
)

dismissBootOverlays()
window.requestAnimationFrame(() => {
  dismissBootOverlays()
  const fallback = document.getElementById('boot-fallback');
  if (fallback) fallback.hidden = true;
})
