import { criarSupabaseAdminClient } from '../../lib/supabaseAdminClient.js';
import type { IntegrationConnector, SyncOptions, SyncResult } from '../types.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from './auth.js';
import { buscarLeads, buscarSessoes, type GA4Row } from './fetch.js';
import { normalizarEGravarSessoes } from './normalize.js';

const mensagemDe = (erro: unknown) => (erro instanceof Error ? erro.message : 'falha desconhecida');

async function sync(integrationId: string, accountId: string | null, options: SyncOptions): Promise<SyncResult> {
  const supabaseAdmin = criarSupabaseAdminClient();
  const credenciais = await obterCredenciais(integrationId);

  // propertyId só é preenchido depois da etapa de seleção de ativos
  // (AssetSelectionDialog) — sem ele, não há o que consultar no Data API.
  if (!credenciais.propertyId) {
    const mensagem = 'GA4: nenhuma propriedade selecionada — abra a integração e escolha uma propriedade antes de sincronizar.';
    return { status: 'error', recordsSynced: 0, errorMessage: mensagem, details: { analytics_sessions_daily: `error: ${mensagem}` } };
  }

  try {
    // Sessões e leads são duas chamadas independentes ao GA4 — rodar em
    // paralelo evita somar a latência das duas. Leads é resgatado com
    // .then/.catch em vez de try/catch: se ela falhar, sessões (já resolvida
    // no mesmo Promise.all) continua gravando normalmente, como antes.
    const [linhas, resultadoLeads] = await Promise.all([
      buscarSessoes(credenciais, options.sinceDate, options.untilDate),
      buscarLeads(credenciais, options.sinceDate, options.untilDate).then(
        (linhasLeads): { ok: true; linhasLeads: GA4Row[] } => ({ ok: true, linhasLeads }),
        (erro): { ok: false; erro: string } => ({ ok: false, erro: mensagemDe(erro) })
      ),
    ]);

    const linhasLeads = resultadoLeads.ok ? resultadoLeads.linhasLeads : undefined;
    const erroLeads = resultadoLeads.ok ? undefined : resultadoLeads.erro;

    const registrosGravados = await normalizarEGravarSessoes(supabaseAdmin, linhas, accountId, linhasLeads);

    if (erroLeads) {
      return {
        status: 'partial',
        recordsSynced: registrosGravados,
        errorMessage: erroLeads,
        details: { analytics_sessions_daily: 'success', analytics_leads: `error: ${erroLeads}` },
      };
    }

    return {
      status: 'success',
      recordsSynced: registrosGravados,
      details: { analytics_sessions_daily: 'success', analytics_leads: 'success' },
    };
  } catch (erro) {
    const mensagem = mensagemDe(erro);
    return {
      status: 'error',
      recordsSynced: 0,
      errorMessage: mensagem,
      details: { analytics_sessions_daily: `error: ${mensagem}` },
    };
  }
}

export const ga4Connector: IntegrationConnector = {
  key: 'ga4',
  refreshCredentialsIfNeeded,
  sync,
};
