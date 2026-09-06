import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Treks frontend keeps its own env only — no shared CrwdCtrl frontend keys.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: __dirname,
})
