import { supabase } from '@/lib/supabaseClient';
import { agruparAnalyticsPorDia } from '@/utils/metricsAggregation';
import type { LeadCostDaily, Platform, Region } from '@/types/database.types';

export interface FiltrosDashboard {
  dataInicio: string;
  dataFim: string;
  platform?: Platform;
  region?: Region;
}

const LIMITE_PRINCIPAIS_PAGINAS = 10;

async function buscarSessoesBrutas(filtros: FiltrosDashboard) {
  let consulta = supabase
    .from('analytics_sessions_daily')
    .select('date, sessions, users, leads, page_path, device')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim);

  if (filtros.region) consulta = consulta.eq('region', filtros.region);

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
    if (filtros.region) consulta = consulta.eq('region', filtros.region);

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

  async obterPrincipaisPaginas(filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'region'>) {
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

  async obterLeadsRecentes(filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'region'>) {
    let consulta = supabase
      .from('leads')
      .select('id, name, email, source, funnel_stage, region, captured_at')
      .gte('captured_at', filtros.dataInicio)
      .lte('captured_at', filtros.dataFim)
      .order('captured_at', { ascending: false })
      .limit(50);

    if (filtros.region) consulta = consulta.eq('region', filtros.region);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async obterCustoPorLeadPorOrigem(filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim'>): Promise<LeadCostDaily[]> {
    const { data, error } = await supabase
      .from('vw_lead_cost_daily')
      .select('*')
      .gte('date', filtros.dataInicio)
      .lte('date', filtros.dataFim)
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
