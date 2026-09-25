import { criarSupabaseAdminClient } from '../../lib/supabaseAdminClient.js';
import type { IntegrationConnector, SyncOptions, SyncResult } from '../types.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from './auth.js';
import { buscarConversoes } from './fetch.js';
import { normalizarEGravarLeads } from './normalize.js';
import { buscarIdentificadoresSelecionados } from '../assetSelection.js';

async function sync(integrationId: string, accountId: string | null, options: SyncOptions): Promise<SyncResult> {
  const supabaseAdmin = criarSupabaseAdminClient();
  const credenciais = await obterCredenciais(integrationId);

  try {
    // Ver assetSelection.ts: array = filtra estritamente a isso; array vazio
    // numa integração NOVA = nada selecionado ainda, não traz nada; undefined
    // = integração antiga que já sincronizava antes desta seleção existir,
    // não filtra (não interrompe o que já funcionava).
    const identificadoresSelecionados = await buscarIdentificadoresSelecionados(supabaseAdmin, integrationId);
    const conversoes = await buscarConversoes(credenciais, options.sinceDate, options.untilDate, identificadoresSelecionados);
    const registrosGravados = await normalizarEGravarLeads(supabaseAdmin, conversoes, accountId);

    return {
      status: 'success',
      recordsSynced: registrosGravados,
      details: { leads: 'success' },
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'falha desconhecida';
    return {
      status: 'error',
      recordsSynced: 0,
      errorMessage: mensagem,
      details: { leads: `error: ${mensagem}` },
    };
  }
}

export const rdStationConnector: IntegrationConnector = {
  key: 'rd_station',
  refreshCredentialsIfNeeded,
  sync,
};
