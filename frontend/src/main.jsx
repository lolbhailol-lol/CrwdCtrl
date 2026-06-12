import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { shouldShowBootSplash, removeHtmlBootSplash, BOOT_SPLASH_TOTAL_MS, hasAuthCallbackParams } from './utils/bootSplash'
import { clearOAuthRedirectMarkers } from './utils/authBootstrap'
import { initThemeClass } from './utils/themeInit'
import { initSentry } from './utils/sentry'
import { isNativeApp } from './utils/capacitorPlatform'
import { initCashfreeNativeGateway } from './utils/bootstrapCashfreeNative'
import { initGlobalErrorHandlers } from './utils/chunkError'

initThemeClass()
initSentry()
initGlobalErrorHandlers()

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
  // Safety net if App.jsx fails before its splash timer runs
  window.setTimeout(removeHtmlBootSplash, BOOT_SPLASH_TOTAL_MS + 400)
}

// PWA service worker — web only (not Capacitor native shell)
if (import.meta.env.PROD && !isNativeApp()) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        // Reload once per session — avoid infinite refresh loops on SW update
        try {
          if (sessionStorage.getItem('crwdctrl_sw_reload')) return
          sessionStorage.setItem('crwdctrl_sw_reload', '1')
        } catch {
          /* ignore */
        }
        window.location.reload()
      },
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
