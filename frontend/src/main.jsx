import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { shouldShowBootSplash, removeHtmlBootSplash } from './utils/bootSplash'
import { initThemeClass } from './utils/themeInit'

initThemeClass()

// OAuth / email flows — skip static HTML splash immediately
if (!shouldShowBootSplash()) {
  removeHtmlBootSplash()
}

// Prod only — dev service-worker reload causes a flash between splash and app
if (import.meta.env.PROD) {
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
