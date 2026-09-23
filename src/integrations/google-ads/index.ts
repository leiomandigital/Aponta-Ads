import { criarSupabaseAdminClient } from '../../lib/supabaseAdminClient.js';
import type { IntegrationConnector, SyncOptions, SyncResult } from '../types.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from './auth.js';
import { buscarPerformance, buscarConversoesNomeadas, buscarPalavrasChave } from './fetch.js';
import { normalizarEGravarPerformance, normalizarEGravarConversoes, normalizarEGravarPalavrasChave } from './normalize.js';

async function sync(options: SyncOptions): Promise<SyncResult> {
  const supabaseAdmin = criarSupabaseAdminClient();
  const credenciais = await obterCredenciais();

  const subBuscas: Array<[string, () => Promise<number>]> = [
    ['ad_performance_daily', async () => normalizarEGravarPerformance(supabaseAdmin, await buscarPerformance(credenciais, options.sinceDate, options.untilDate))],
    ['ad_conversions_daily', async () => normalizarEGravarConversoes(supabaseAdmin, await buscarConversoesNomeadas(credenciais, options.sinceDate, options.untilDate))],
    ['ad_keyword_performance_daily', async () => normalizarEGravarPalavrasChave(supabaseAdmin, await buscarPalavrasChave(credenciais, options.sinceDate, options.untilDate))],
  ];

  // Mesmo motivo do Meta Ads: 3 consultas GAQL independentes — rodar em
  // paralelo evita somar a latência das 3 e ajuda a caber no tempo máximo da
  // função. Promise.allSettled isola falhas entre elas.
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
    errorMessage: todasFalharam ? 'Todas as sub-buscas do Google Ads falharam' : undefined,
  };
}

export const googleAdsConnector: IntegrationConnector = {
  key: 'google_ads',
  refreshCredentialsIfNeeded,
  sync,
};
