import { criarSupabaseAdminClient } from '../../lib/supabaseAdminClient.js';
import type { IntegrationConnector, SyncOptions, SyncResult } from '../types.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from './auth.js';
import { buscarConversoes } from './fetch.js';
import { normalizarEGravarLeads } from './normalize.js';

async function sync(options: SyncOptions): Promise<SyncResult> {
  const supabaseAdmin = criarSupabaseAdminClient();
  const credenciais = await obterCredenciais();

  try {
    const conversoes = await buscarConversoes(credenciais, options.sinceDate, options.untilDate);
    const registrosGravados = await normalizarEGravarLeads(supabaseAdmin, conversoes);

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
