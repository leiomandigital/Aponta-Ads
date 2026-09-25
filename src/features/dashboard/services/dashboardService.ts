import { supabase } from '@/lib/supabaseClient';
import { agruparAnalyticsPorDia } from '@/utils/metricsAggregation';
import type { LeadCostDaily, Platform } from '@/types/database.types';

export interface FiltrosDashboard {
  dataInicio: string;
  dataFim: string;
  platform?: Platform;
  /** undefined = "Geral" (soma as contas ativas + as compartilhadas). */
  accountId?: string;
  /** Contas desativadas — só é usado quando accountId é undefined (visão "Geral"); numa conta específica ela já não aparece pra ser selecionada. */
  idsContasInativas?: string[];
}

const LIMITE_PRINCIPAIS_PAGINAS = 10;

/**
 * Uma conta específica precisa enxergar tanto as próprias linhas quanto as de
 * qualquer integração COMPARTILHADA (account_id nulo) — um .eq() simples
 * esconderia o dado de uma integração única das visões por conta.
 *
 * accountId undefined é "Geral": soma tudo, MAS excluindo o que pertence a
 * uma conta desativada (ela não deve entrar em somatória nenhuma — só
 * continua existindo no banco). account_id nulo (compartilhado) nunca é
 * excluído aqui: desativar a conta que originalmente compartilhou uma
 * integração não deve tirar o dado das demais contas ainda ativas.
 */
function filtroDeConta(accountId: string | undefined, idsContasInativas: string[] = []): string | null {
  if (accountId) return `account_id.eq.${accountId},account_id.is.null`;
  if (idsContasInativas.length > 0) return `account_id.is.null,account_id.not.in.(${idsContasInativas.join(',')})`;
  return null;
}

async function buscarSessoesBrutas(filtros: FiltrosDashboard) {
  let consulta = supabase
    .from('analytics_sessions_daily')
    .select('date, sessions, users, leads, page_path, device')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim);

  const filtroConta = filtroDeConta(filtros.accountId, filtros.idsContasInativas);
  if (filtroConta) consulta = consulta.or(filtroConta);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const dashboardService = {
  /**
   * Linhas brutas de ad_performance_daily (com granularidade de campanha,
   * conjunto de anúncio e anúncio) — KPIs, gráfico e as três tabelas de
   * drill-down (campanha → conjunto → anúncio) são todos derivados destas
   * mesmas linhas no cliente, sem consulta adicional ao banco por seleção.
   */
  async obterLinhasDeMidia(filtros: FiltrosDashboard) {
    let consulta = supabase
      .from('ad_performance_daily')
      .select('date, platform, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, impressions, clicks, cost, conversions')
      .gte('date', filtros.dataInicio)
      .lte('date', filtros.dataFim);

    if (filtros.platform) consulta = consulta.eq('platform', filtros.platform);
    const filtroContaMidia = filtroDeConta(filtros.accountId, filtros.idsContasInativas);
    if (filtroContaMidia) consulta = consulta.or(filtroContaMidia);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async obterMetricasAnalytics(filtros: FiltrosDashboard) {
    const linhas = await buscarSessoesBrutas(filtros);
    const totais = linhas.reduce(
      (acumulado, linha) => ({
        sessions: acumulado.sessions + linha.sessions,
        users: acumulado.users + linha.users,
        leads: acumulado.leads + linha.leads,
      }),
      { sessions: 0, users: 0, leads: 0 }
    );
    // temDados distingue "mediu e deu zero" de "não tem nada para medir" — o
    // card usa isso para mostrar "—" em vez de "0" quando não há nenhuma linha.
    return { ...totais, temDados: linhas.length > 0 };
  },

  async obterSerieTemporalAnalytics(filtros: FiltrosDashboard) {
    const linhas = await buscarSessoesBrutas(filtros);
    return agruparAnalyticsPorDia(linhas);
  },

  async obterPrincipaisPaginas(filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'accountId' | 'idsContasInativas'>) {
    const linhas = await buscarSessoesBrutas(filtros);
    const sessoesPorPagina = new Map<string, number>();

    for (const linha of linhas) {
      const pagina = linha.page_path ?? '(não definida)';
      sessoesPorPagina.set(pagina, (sessoesPorPagina.get(pagina) ?? 0) + linha.sessions);
    }

    return Array.from(sessoesPorPagina.entries())
      .map(([page_path, sessions]) => ({ page_path, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, LIMITE_PRINCIPAIS_PAGINAS);
  },

  async obterLeadsRecentes(filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'accountId' | 'idsContasInativas'>) {
    let consulta = supabase
      .from('leads')
      .select('id, name, email, source, funnel_stage, region, captured_at')
      .gte('captured_at', filtros.dataInicio)
      .lte('captured_at', filtros.dataFim)
      .order('captured_at', { ascending: false })
      .limit(50);

    const filtroContaLeads = filtroDeConta(filtros.accountId, filtros.idsContasInativas);
    if (filtroContaLeads) consulta = consulta.or(filtroContaLeads);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async obterCustoPorLeadPorOrigem(
    filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'accountId' | 'idsContasInativas'>
  ): Promise<LeadCostDaily[]> {
    let consulta = supabase
      .from('vw_lead_cost_daily')
      .select('*')
      .gte('date', filtros.dataInicio)
      .lte('date', filtros.dataFim)
      .order('date', { ascending: false });

    const filtroContaCusto = filtroDeConta(filtros.accountId, filtros.idsContasInativas);
    if (filtroContaCusto) consulta = consulta.or(filtroContaCusto);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
