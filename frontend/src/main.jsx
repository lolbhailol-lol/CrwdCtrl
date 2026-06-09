import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { shouldShowBootSplash, removeHtmlBootSplash } from './utils/bootSplash'
import { initThemeClass } from './utils/themeInit'
import { initSentry } from './utils/sentry'
import { isNativeApp } from './utils/capacitorPlatform'

initThemeClass()
initSentry()

// OAuth / email flows — skip static HTML splash immediately
if (!shouldShowBootSplash()) {
  removeHtmlBootSplash()
}

// PWA service worker — web only (not Capacitor native shell)
if (import.meta.env.PROD && !isNativeApp()) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        window.location.reload()
      },
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
