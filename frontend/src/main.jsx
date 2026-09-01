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
import { initGlobalErrorHandlers, markAppBootSuccess } from './utils/chunkError'
import { dismissBootOverlays } from './utils/dismissBootOverlays'
import { isSafariBrowser } from './utils/safariBrowser'
import { preloadCategoryNavIcons } from './constants/categoryNavIcons'
import { SpeedInsights } from '@vercel/speed-insights/react'

initThemeClass()
initSentry()
initGlobalErrorHandlers()
markAppBootSuccess()
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

// PWA service worker — web only (not Capacitor native shell)
if (import.meta.env.PROD && !isNativeApp()) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW() {
        // Drop legacy Workbox API caches (NetworkFirst/NetworkOnly) that threw
        // no-response when Railway was cold and could serve stale empty JSON.
        if (!('caches' in window)) return;
        caches.keys().then((keys) => {
          keys
            .filter((key) => /api-cache/i.test(key))
            .forEach((key) => caches.delete(key));
        }).catch(() => {});
      },
    });
    navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
      registrations.forEach((registration) => {
        const scriptUrl = String(
          registration.active?.scriptURL
          || registration.waiting?.scriptURL
          || registration.installing?.scriptURL
          || '',
        );
        if (scriptUrl.includes('firebase-messaging-sw.js')) {
          registration.unregister().catch(() => {});
        }
      });
    }).catch(() => {});
  });
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
