import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/start/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: {
        name: 'Míre',
        short_name: 'Míre',
        start_url: '/start/',
        scope: '/start/',
        display: 'standalone',
        lang: 'es',
        // Provisional colours and icons: the definitive ones come with SPEC-0003.
        theme_color: '#0B132B',
        background_color: '#F8FAFC',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Includes the SQLite worker chunk (assets/*.js) and sqlite3.wasm.
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // autoUpdate: a new version takes over open pages without waiting.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  optimizeDeps: {
    // sqlite-wasm loads sqlite3.wasm relative to its own module URL.
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
