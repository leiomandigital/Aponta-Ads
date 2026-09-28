import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../src/lib/supabaseAdminClient.js';
import { buscarConfiguracoesDeMarca } from './_lib/reportData.js';

const NOME_PADRAO = 'ApontaAds';

/**
 * Manifest do PWA gerado na hora (em vez do manifest.webmanifest estático
 * que o VitePWA geraria) — é a única forma do nome do app na tela de início
 * do celular (Android) refletir o system_name configurado em Configurações
 * → Marca sem precisar rebuildar o app. Ver index.html (link rel="manifest")
 * e vite.config.ts (manifest: false, pra não conflitar com este arquivo).
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  let nome = NOME_PADRAO;

  try {
    const supabaseAdmin = criarSupabaseAdminClient();
    const configuracoes = await buscarConfiguracoesDeMarca(supabaseAdmin);
    nome = configuracoes?.system_name?.trim() || NOME_PADRAO;
  } catch (erro) {
    // Falha ao ler configurações não pode derrubar o manifest — instalar o
    // app com o nome padrão é melhor do que o navegador recusar a instalação.
    console.error('Falha ao buscar nome do sistema para o manifest:', erro instanceof Error ? erro.message : erro);
  }

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    name: nome,
    short_name: nome,
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
  });
}
