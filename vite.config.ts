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
      // manifest: false — o manifest.webmanifest não vem mais deste plugin
      // (estático, preso ao build). O nome do app precisa refletir o
      // system_name configurado em Configurações → Marca sem rebuild, então
      // quem serve o manifest agora é api/manifest.ts; index.html aponta
      // <link rel="manifest"> pra lá.
      manifest: false,
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
