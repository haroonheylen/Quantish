import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
  port: 5173,
  proxy: {
    // The frontend always calls /api/... and never needs to know where the API lives.
    // In dev, Vite forwards those requests to Nest on port 3000 and strips the /api prefix.
    // Same origin from the browser's point of view, so no CORS setup is needed.
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
