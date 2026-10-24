import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  base: '/start/',
  resolve: {
    alias: { '@': path('./src') },
  },
  plugins: [
    react(),
    tailwindcss(),
    // Material Symbols as React components: `…/rounded/<name>.svg?react` (SPEC-0003 §6).
    svgr(),
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
        theme_color: '#0B132B',
        background_color: '#0B132B',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Includes the SQLite worker chunk (assets/*.js), sqlite3.wasm and the Sora .woff2 files.
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // The style guide is its own page: navigations to it must not fall back to index.html.
        navigateFallbackDenylist: [/estilo\.html$/],
        // autoUpdate: a new version takes over open pages without waiting. vite-plugin-pwa only
        // sets skipWaiting; clientsClaim makes the SW control the page on the first visit (CA-07).
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: { main: path('./index.html'), estilo: path('./estilo.html') },
    },
  },
  optimizeDeps: {
    // sqlite-wasm loads sqlite3.wasm relative to its own module URL.
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
  test: {
    // .tsx tests declare `// @vitest-environment jsdom`; .ts tests run in node.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
