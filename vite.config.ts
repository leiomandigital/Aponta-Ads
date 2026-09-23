import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { apiDevMiddleware } from './vite-plugins/apiDevMiddleware';

export default defineConfig({
  plugins: [
    react(),
    apiDevMiddleware(),
    VitePWA({
      registerType: 'autoUpdate',
      // Sem isso, o manifest.webmanifest só existe depois do `build` — em
      // `vite dev` o navegador recebe o fallback de SPA (HTML) ao pedir esse
      // arquivo e reporta "Syntax error" ao tentar interpretá-lo como JSON.
      // type: 'module' é só para a estratégia injectManifest — aqui usamos
      // generateSW (padrão), que espera o worker clássico.
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ApontaAds',
        short_name: 'ApontaAds',
        description: 'Painel de marketing digital — Google Ads, GA4, Meta Ads e RD Station em um só lugar',
        start_url: '/',
        display: 'standalone',
        theme_color: '#7a1332',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
