import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

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
        manualChunks: (id) => {
          // Vendor chunk for core React libraries
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // UI libraries chunk
            if (id.includes('lucide-react') || id.includes('react-icons')) {
              return 'vendor-ui';
            }
            // Firebase chunk
            if (id.includes('firebase') || id.includes('better-auth')) {
              return 'vendor-auth';
            }
            // Utilities chunk
            if (id.includes('axios') || id.includes('react-responsive')) {
              return 'vendor-utils';
            }
            // All other node_modules
            return 'vendor-misc';
          }

          // Pages chunks - group related pages together
          if (id.includes('/pages/profile-pages/')) {
            return 'pages-profile';
          }
          if (id.includes('/pages/') && (id.includes('fest') || id.includes('competition'))) {
            return 'pages-fest';
          }
          if (id.includes('/context/')) {
            return 'app-context';
          }
          if (id.includes('/components/') && !id.includes('/pages/')) {
            return 'app-components';
          }
        }
      }
    }
  },

  // Environment variables configuration
  envPrefix: ['VITE_'],

  // Preview configuration for production testing
  preview: {
    port: 4173,
    host: true
  }
})
