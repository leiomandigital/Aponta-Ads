import type { SupabaseClient } from '@supabase/supabase-js';
import { agruparAnalyticsPorDia, agruparMidiaPorDia, calcularMetricasAgregadas } from '../../src/utils/metricsAggregation.js';
import type { AggregatedMetrics, DashboardSettings, LeadCostDaily, Platform, Region } from '../../src/types/database.types.js';

export interface FiltrosRelatorio {
  dataInicio: string;
  dataFim: string;
  platform?: Platform;
  region?: Region;
}

export async function buscarMetricasDeMidiaPaga(
  supabaseAdmin: SupabaseClient,
  filtros: FiltrosRelatorio
): Promise<AggregatedMetrics> {
  let consulta = supabaseAdmin
    .from('ad_performance_daily')
    .select('impressions, clicks, cost, conversions')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim);

  if (filtros.platform) consulta = consulta.eq('platform', filtros.platform);
  if (filtros.region) consulta = consulta.eq('region', filtros.region);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return calcularMetricasAgregadas(data ?? []);
}

export async function buscarSerieTemporalMidiaPaga(supabaseAdmin: SupabaseClient, filtros: FiltrosRelatorio) {
  let consulta = supabaseAdmin
    .from('ad_performance_daily')
    .select('date, impressions, clicks, cost, conversions')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim);

  if (filtros.platform) consulta = consulta.eq('platform', filtros.platform);
  if (filtros.region) consulta = consulta.eq('region', filtros.region);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return agruparMidiaPorDia(data ?? []);
}

export async function buscarMetricasAnalytics(
  supabaseAdmin: SupabaseClient,
  filtros: Pick<FiltrosRelatorio, 'dataInicio' | 'dataFim' | 'region'>
): Promise<{ sessions: number; users: number; leads: number }> {
  let consulta = supabaseAdmin
    .from('analytics_sessions_daily')
    .select('sessions, users, leads')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim);

  if (filtros.region) consulta = consulta.eq('region', filtros.region);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  return (data ?? []).reduce(
    (acumulado, linha) => ({
      sessions: acumulado.sessions + linha.sessions,
      users: acumulado.users + linha.users,
      leads: acumulado.leads + linha.leads,
    }),
    { sessions: 0, users: 0, leads: 0 }
  );
}

export async function buscarSerieTemporalAnalytics(
  supabaseAdmin: SupabaseClient,
  filtros: Pick<FiltrosRelatorio, 'dataInicio' | 'dataFim' | 'region'>
) {
  let consulta = supabaseAdmin
    .from('analytics_sessions_daily')
    .select('date, sessions, users, leads')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim);

  if (filtros.region) consulta = consulta.eq('region', filtros.region);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return agruparAnalyticsPorDia(data ?? []);
}

/** Top 10 páginas por sessões — dá ao relatório de Analytics uma tabela própria, já que GA4 não tem "campanha". */
export async function buscarSessoesPorPagina(
  supabaseAdmin: SupabaseClient,
  filtros: Pick<FiltrosRelatorio, 'dataInicio' | 'dataFim' | 'region'>
) {
  let consulta = supabaseAdmin
    .from('analytics_sessions_daily')
    .select('page_path, sessions, users')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim);

  if (filtros.region) consulta = consulta.eq('region', filtros.region);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  const porPagina = new Map<string, { page_path: string; sessions: number; users: number }>();

  for (const linha of data ?? []) {
    const pagina = linha.page_path ?? '(não identificada)';
    const acumulado = porPagina.get(pagina) ?? { page_path: pagina, sessions: 0, users: 0 };
    porPagina.set(pagina, {
      page_path: pagina,
      sessions: acumulado.sessions + linha.sessions,
      users: acumulado.users + linha.users,
    });
  }

  return Array.from(porPagina.values())
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);
}

// Nunca incluir leads individuais (nome/e-mail) no PDF — só o agregado por
// origem. Ver Data Security Skill, seção 2.
export async function buscarCustoPorLeadPorOrigem(
  supabaseAdmin: SupabaseClient,
  filtros: Pick<FiltrosRelatorio, 'dataInicio' | 'dataFim'>
): Promise<LeadCostDaily[]> {
  const { data, error } = await supabaseAdmin
    .from('vw_lead_cost_daily')
    .select('*')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim)
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function buscarCampanhas(supabaseAdmin: SupabaseClient, filtros: FiltrosRelatorio) {
  let consulta = supabaseAdmin
    .from('ad_performance_daily')
    .select('platform, campaign_id, campaign_name, impressions, clicks, cost, conversions')
    .gte('date', filtros.dataInicio)
    .lte('date', filtros.dataFim);

  if (filtros.platform) consulta = consulta.eq('platform', filtros.platform);
  if (filtros.region) consulta = consulta.eq('region', filtros.region);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  const porCampanha = new Map<
    string,
    { campaign_id: string; campaign_name: string | null; platform: string; impressions: number; clicks: number; cost: number; conversions: number }
  >();

  for (const linha of data ?? []) {
    const chave = `${linha.platform}:${linha.campaign_id}`;
    const acumulado = porCampanha.get(chave) ?? {
      campaign_id: linha.campaign_id,
      campaign_name: linha.campaign_name,
      platform: linha.platform,
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
    };
    porCampanha.set(chave, {
      ...acumulado,
      impressions: acumulado.impressions + linha.impressions,
      clicks: acumulado.clicks + linha.clicks,
      cost: acumulado.cost + linha.cost,
      conversions: acumulado.conversions + linha.conversions,
    });
  }

  return Array.from(porCampanha.values())
    .map((campanha) => ({ ...campanha, ...calcularMetricasAgregadas([campanha]) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20);
}

export async function buscarConfiguracoesDeMarca(supabaseAdmin: SupabaseClient): Promise<DashboardSettings | null> {
  const { data, error } = await supabaseAdmin.from('dashboard_settings').select('*').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
