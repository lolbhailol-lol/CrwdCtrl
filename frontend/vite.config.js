import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // We'll register the SW in `src/main.jsx` to control update behavior.
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo-crwdctrl.png', 'crwdctrl-mark.png', 'icon-192x192.png', 'icon-512x512.png', 'robots.txt', 'sitemap.xml', 'llms.txt', 'category-icons/*.webp'],
      manifest: {
        name: 'CrwdCtrl — Discover College Fests',
        short_name: 'CrwdCtrl',
        description: 'Discover and register for college fests, competitions, and events near you.',
        theme_color: '#0E0E0F',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/logo-crwdctrl.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Bump when changing runtime cache strategy so installed devices drop old SW caches
        cacheId: 'crwdctrl-v3',
        // Ensure new builds activate quickly and old caches are removed.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Don't precache the firebase messaging sw
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/firebase-messaging-sw\.js$/,
          /^\/api\//,
        ],
        runtimeCaching: [
          {
            // Always prefer network for HTML navigations after deploy
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
            },
          },
          // Intentionally NO /api runtimeCaching rule.
          // Workbox NetworkOnly/NetworkFirst throw uncaught "no-response" when Railway
          // is cold/unreachable; that surfaces as SW errors on iPhone/laptop and can
          // block normal fetch retries. Let API requests bypass the SW entirely.
          {
            // Cache images (CacheFirst)
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],

  // Define which environment variables to expose to the client
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },

  // Server configuration for development
  server: {
    port: 5173,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps in production for better performance
    // Generate manifest for better caching
    manifest: true,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Rollup options for better optimization
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // Auth / Firebase — large, rarely changes with UI deploys
          if (id.includes('firebase')) {
            return 'vendor-auth';
          }

          // React ecosystem — keep together so createContext/JSX always resolve
          if (
            id.includes('/react/')
            || id.includes('/react-dom/')
            || id.includes('react-router')
            || id.includes('framer-motion')
            || id.includes('@sentry/react')
            || id.includes('lucide-react')
            || id.includes('scheduler/')
          ) {
            return 'vendor-react';
          }

          return 'vendor-misc';
        },
      },
    },
  },

  // Strip console.log / debugger in production builds
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },

  // Environment variables configuration
  envPrefix: ['VITE_'],

  // Preview configuration for production testing
  preview: {
    port: 4173,
    host: true
  }
}))
