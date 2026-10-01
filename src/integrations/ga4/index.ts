import { criarSupabaseAdminClient } from '../../lib/supabaseAdminClient.js';
import type { IntegrationConnector, SyncOptions, SyncResult } from '../types.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from './auth.js';
import { buscarDetalhamentoLeads, buscarLeads, buscarSessoes, type GA4Row } from './fetch.js';
import { normalizarEGravarSessoes } from './normalize.js';
import { normalizarEGravarDetalhamentoLeads } from './normalizeBreakdown.js';

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
    const [linhas, resultadoLeads, resultadosDetalhamento] = await Promise.all([
      buscarSessoes(credenciais, options.sinceDate, options.untilDate),
      buscarLeads(credenciais, options.sinceDate, options.untilDate).then(
        (linhasLeads): { ok: true; linhasLeads: GA4Row[] } => ({ ok: true, linhasLeads }),
        (erro): { ok: false; erro: string } => ({ ok: false, erro: mensagemDe(erro) })
      ),
      // Jornada do lead (caminho, origem, demografia, retorno, tempo): cada dimensão
      // já isola a própria falha (ver fetch.ts) — nunca derruba sessões/leads.
      buscarDetalhamentoLeads(credenciais, options.sinceDate, options.untilDate),
    ]);

    const linhasLeads = resultadoLeads.ok ? resultadoLeads.linhasLeads : undefined;
    const erroLeads = resultadoLeads.ok ? undefined : resultadoLeads.erro;

    const registrosGravados = await normalizarEGravarSessoes(supabaseAdmin, linhas, accountId, linhasLeads);

    const detalhamento = await normalizarEGravarDetalhamentoLeads(supabaseAdmin, resultadosDetalhamento, accountId);
    const errosDetalhamento = Object.values(detalhamento.detalhes).filter((valor) => valor.startsWith('error'));
    const totalGravado = registrosGravados + detalhamento.gravados;

    const details = {
      analytics_sessions_daily: 'success',
      analytics_leads: erroLeads ? `error: ${erroLeads}` : 'success',
      ...detalhamento.detalhes,
    };

    if (erroLeads || errosDetalhamento.length > 0) {
      return {
        status: 'partial',
        recordsSynced: totalGravado,
        errorMessage: erroLeads ?? errosDetalhamento[0],
        details,
      };
    }

    return { status: 'success', recordsSynced: totalGravado, details };
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
