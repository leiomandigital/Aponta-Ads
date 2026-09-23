import { criarSupabaseAdminClient } from '../../lib/supabaseAdminClient.js';
import type { IntegrationConnector, SyncOptions, SyncResult } from '../types.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from './auth.js';
import { buscarPerformance, buscarConversoesPorEvento, buscarDemografia, buscarMetricasDeVideo } from './fetch.js';
import {
  normalizarEGravarPerformance,
  normalizarEGravarConversoes,
  normalizarEGravarDemografia,
  normalizarEGravarVideo,
} from './normalize.js';

async function sync(options: SyncOptions): Promise<SyncResult> {
  const supabaseAdmin = criarSupabaseAdminClient();
  const credenciais = await obterCredenciais();

  const subBuscas: Array<[string, () => Promise<number>]> = [
    ['ad_performance_daily', async () => normalizarEGravarPerformance(supabaseAdmin, await buscarPerformance(credenciais, options.sinceDate, options.untilDate))],
    ['ad_conversions_daily', async () => normalizarEGravarConversoes(supabaseAdmin, await buscarConversoesPorEvento(credenciais, options.sinceDate, options.untilDate))],
    ['ad_performance_demographics_daily', async () => normalizarEGravarDemografia(supabaseAdmin, await buscarDemografia(credenciais, options.sinceDate, options.untilDate))],
    ['ad_video_metrics_daily', async () => normalizarEGravarVideo(supabaseAdmin, await buscarMetricasDeVideo(credenciais, options.sinceDate, options.untilDate))],
  ];

  // As 4 sub-buscas são chamadas independentes à API do Meta — rodar em série
  // soma a latência das 4 (risco real de estourar o tempo máximo da função na
  // Vercel); em paralelo, o tempo total passa a ser o da mais lenta, não a
  // soma. Promise.allSettled garante que uma falhar não derruba as outras —
  // mesma regra que o dispatch.ts já aplica entre integrações diferentes.
  const resultados = await Promise.allSettled(subBuscas.map(([, executar]) => executar()));

  const detalhes: Record<string, string> = {};
  let totalRegistros = 0;
  let houveErro = false;

  resultados.forEach((resultado, indice) => {
    const [tabela] = subBuscas[indice];
    if (resultado.status === 'fulfilled') {
      totalRegistros += resultado.value;
      detalhes[tabela] = 'success';
    } else {
      houveErro = true;
      detalhes[tabela] = `error: ${resultado.reason instanceof Error ? resultado.reason.message : 'falha desconhecida'}`;
    }
  });

  const todasFalharam = Object.values(detalhes).every((resultado) => resultado.startsWith('error'));

  return {
    status: todasFalharam ? 'error' : houveErro ? 'partial' : 'success',
    recordsSynced: totalRegistros,
    details: detalhes,
    errorMessage: todasFalharam ? 'Todas as sub-buscas do Meta Ads falharam' : undefined,
  };
}

export const metaAdsConnector: IntegrationConnector = {
  key: 'meta_ads',
  refreshCredentialsIfNeeded,
  sync,
};
