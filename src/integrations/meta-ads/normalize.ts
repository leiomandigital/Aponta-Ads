import type { SupabaseClient } from '@supabase/supabase-js';
import { paraDataSaoPaulo } from '../timezone.js';
import { resolverRegioesDasCampanhas } from '../regionResolver.js';
import { intervaloDeDatas, linhasParaGravar } from '../diffUpsert.js';

interface MetaInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  impressions?: string;
  inline_link_clicks?: string;
  spend?: string;
  age?: string;
  gender?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  video_play_actions?: Array<{ action_type: string; value: string }>;
  video_thruplay_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p25_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p50_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p75_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p100_watched_actions?: Array<{ action_type: string; value: string }>;
}

// Mapeia o action_type bruto do Meta para o nome de conversão padronizado do ApontaAds.
const MAPA_EVENTOS_CONVERSAO: Record<string, string> = {
  'offsite_conversion.fb_pixel_lead': 'lead',
  lead: 'lead',
  purchase: 'venda',
  'offsite_conversion.fb_pixel_purchase': 'venda',
  complete_registration: 'registro_concluido',
  landing_page_view: 'visualizacao_pagina_destino',
};

function somarValorAcao(acoes: Array<{ action_type: string; value: string }> | undefined, tipo: string): number {
  return acoes?.filter((acao) => acao.action_type === tipo).reduce((soma, acao) => soma + Number(acao.value), 0) ?? 0;
}

export async function normalizarEGravarPerformance(
  supabaseAdmin: SupabaseClient,
  linhas: MetaInsightRow[],
  accountId: string | null
): Promise<number> {
  if (linhas.length === 0) return 0;

  const regioes = await resolverRegioesDasCampanhas(supabaseAdmin, 'meta_ads');

  const linhasNormalizadas = linhas.map((linha) => {
    const campaignId = linha.campaign_id ?? '';

    return {
      platform: 'meta_ads',
      campaign_id: campaignId,
      campaign_name: linha.campaign_name ?? null,
      adset_id: linha.adset_id ?? null,
      adset_name: linha.adset_name ?? null,
      ad_id: linha.ad_id ?? null,
      ad_name: linha.ad_name ?? null,
      date: paraDataSaoPaulo(linha.date_start ?? new Date().toISOString()),
      impressions: Number(linha.impressions ?? 0),
      clicks: Number(linha.inline_link_clicks ?? 0), // cliques no link, não clique genérico
      cost: Number(linha.spend ?? 0),
      conversions: 0, // conversões vêm da consulta separada por evento
      region: regioes.get(campaignId) ?? null,
      account_id: accountId,
    };
  });

  const { min, max } = intervaloDeDatas(linhasNormalizadas.map((linha) => linha.date));
  let consultaExistentes = supabaseAdmin
    .from('ad_performance_daily')
    .select('platform, campaign_id, adset_id, ad_id, date, account_id, campaign_name, adset_name, ad_name, impressions, clicks, cost, conversions, region')
    .eq('platform', 'meta_ads')
    .gte('date', min)
    .lte('date', max);
  consultaExistentes = accountId ? consultaExistentes.eq('account_id', accountId) : consultaExistentes.is('account_id', null);

  const { data: existentes, error: erroExistentes } = await consultaExistentes;
  if (erroExistentes) throw new Error(erroExistentes.message);

  const paraGravar = linhasParaGravar(
    linhasNormalizadas,
    existentes ?? [],
    ['platform', 'campaign_id', 'adset_id', 'ad_id', 'date', 'account_id'],
    ['campaign_name', 'adset_name', 'ad_name', 'impressions', 'clicks', 'cost', 'conversions', 'region']
  );
  if (paraGravar.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('ad_performance_daily')
    .upsert(paraGravar, { onConflict: 'platform,campaign_id,adset_id,ad_id,date,account_id' });

  if (error) throw new Error(error.message);
  return paraGravar.length;
}

interface ConversaoAcumulada {
  platform: 'meta_ads';
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  date: string;
  conversion_name: string;
  conversions: number;
  conversion_value: number;
  region: 'ES' | 'TO' | null;
  account_id: string | null;
}

export async function normalizarEGravarConversoes(
  supabaseAdmin: SupabaseClient,
  linhas: MetaInsightRow[],
  accountId: string | null
): Promise<number> {
  // O campo ad_id não faz parte da granularidade desta tabela (migration 008),
  // mas a consulta usa level:'ad' — mais de um anúncio do mesmo conjunto pode
  // cair na mesma chave aqui. Duas linhas com a mesma chave no mesmo upsert
  // quebram com "ON CONFLICT DO UPDATE command cannot affect row a second
  // time" — por isso somamos as duplicatas num mapa antes de gravar.
  const regioes = await resolverRegioesDasCampanhas(supabaseAdmin, 'meta_ads');
  const porChave = new Map<string, ConversaoAcumulada>();

  for (const linha of linhas) {
    const campaignId = linha.campaign_id ?? '';
    const region = regioes.get(campaignId) ?? null;
    const dataFormatada = paraDataSaoPaulo(linha.date_start ?? new Date().toISOString());

    for (const [tipoOriginal, nomePadronizado] of Object.entries(MAPA_EVENTOS_CONVERSAO)) {
      const conversoes = somarValorAcao(linha.actions, tipoOriginal);
      if (conversoes === 0) continue;

      const chave = [campaignId, linha.adset_id ?? '', nomePadronizado, dataFormatada].join('|');
      const valor = somarValorAcao(linha.action_values, tipoOriginal);
      const existente = porChave.get(chave);

      if (existente) {
        existente.conversions += conversoes;
        existente.conversion_value += valor;
      } else {
        porChave.set(chave, {
          platform: 'meta_ads',
          campaign_id: campaignId,
          campaign_name: linha.campaign_name ?? null,
          adset_id: linha.adset_id ?? null,
          adset_name: linha.adset_name ?? null,
          date: dataFormatada,
          conversion_name: nomePadronizado,
          conversions: conversoes,
          conversion_value: valor,
          region,
          account_id: accountId,
        });
      }
    }
  }

  const linhasNormalizadas = [...porChave.values()].map((linha) => ({
    ...linha,
    conversion_value: linha.conversion_value || null,
  }));

  if (linhasNormalizadas.length === 0) return 0;

  const { min, max } = intervaloDeDatas(linhasNormalizadas.map((linha) => linha.date));
  let consultaExistentes = supabaseAdmin
    .from('ad_conversions_daily')
    .select('platform, campaign_id, adset_id, conversion_name, date, account_id, campaign_name, adset_name, conversions, conversion_value, region')
    .eq('platform', 'meta_ads')
    .gte('date', min)
    .lte('date', max);
  consultaExistentes = accountId ? consultaExistentes.eq('account_id', accountId) : consultaExistentes.is('account_id', null);

  const { data: existentes, error: erroExistentes } = await consultaExistentes;
  if (erroExistentes) throw new Error(erroExistentes.message);

  const paraGravar = linhasParaGravar(
    linhasNormalizadas,
    existentes ?? [],
    ['platform', 'campaign_id', 'adset_id', 'conversion_name', 'date', 'account_id'],
    ['campaign_name', 'adset_name', 'conversions', 'conversion_value', 'region']
  );
  if (paraGravar.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('ad_conversions_daily')
    .upsert(paraGravar, { onConflict: 'platform,campaign_id,adset_id,conversion_name,date,account_id' });

  if (error) throw new Error(error.message);
  return paraGravar.length;
}

interface DemografiaAcumulada {
  platform: 'meta_ads';
  campaign_id: string;
  date: string;
  age_range: string | null;
  gender: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  region: 'ES' | 'TO' | null;
  account_id: string | null;
}

export async function normalizarEGravarDemografia(
  supabaseAdmin: SupabaseClient,
  linhas: MetaInsightRow[],
  accountId: string | null
): Promise<number> {
  if (linhas.length === 0) return 0;

  const regioes = await resolverRegioesDasCampanhas(supabaseAdmin, 'meta_ads');

  // Mesmo motivo de normalizarEGravarConversoes: a consulta roda em
  // level:'ad' (buscarInsights sempre usa isso), mas esta tabela não tem
  // ad_id no grão — mais de um anúncio da mesma campanha cai na mesma chave
  // aqui. Duas linhas com a mesma chave no mesmo upsert quebram com "ON
  // CONFLICT DO UPDATE command cannot affect row a second time" — por isso
  // somamos as duplicatas num mapa antes de gravar.
  const porChave = new Map<string, DemografiaAcumulada>();

  for (const linha of linhas) {
    const campaignId = linha.campaign_id ?? '';
    const dataFormatada = paraDataSaoPaulo(linha.date_start ?? new Date().toISOString());
    const ageRange = linha.age ?? null;
    const gender = linha.gender ?? null;
    const chave = [campaignId, ageRange, gender, dataFormatada].join('|');

    const existente = porChave.get(chave);
    if (existente) {
      existente.impressions += Number(linha.impressions ?? 0);
      existente.clicks += Number(linha.inline_link_clicks ?? 0);
      existente.cost += Number(linha.spend ?? 0);
    } else {
      porChave.set(chave, {
        platform: 'meta_ads',
        campaign_id: campaignId,
        date: dataFormatada,
        age_range: ageRange,
        gender,
        impressions: Number(linha.impressions ?? 0),
        clicks: Number(linha.inline_link_clicks ?? 0),
        cost: Number(linha.spend ?? 0),
        region: regioes.get(campaignId) ?? null,
        account_id: accountId,
      });
    }
  }

  const linhasNormalizadas = [...porChave.values()];
  if (linhasNormalizadas.length === 0) return 0;

  const { min, max } = intervaloDeDatas(linhasNormalizadas.map((linha) => linha.date));
  let consultaExistentes = supabaseAdmin
    .from('ad_performance_demographics_daily')
    .select('platform, campaign_id, age_range, gender, date, account_id, impressions, clicks, cost, region')
    .eq('platform', 'meta_ads')
    .gte('date', min)
    .lte('date', max);
  consultaExistentes = accountId ? consultaExistentes.eq('account_id', accountId) : consultaExistentes.is('account_id', null);

  const { data: existentes, error: erroExistentes } = await consultaExistentes;
  if (erroExistentes) throw new Error(erroExistentes.message);

  const paraGravar = linhasParaGravar(
    linhasNormalizadas,
    existentes ?? [],
    ['platform', 'campaign_id', 'age_range', 'gender', 'date', 'account_id'],
    ['impressions', 'clicks', 'cost', 'region']
  );
  if (paraGravar.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('ad_performance_demographics_daily')
    .upsert(paraGravar, { onConflict: 'platform,campaign_id,age_range,gender,date,account_id' });

  if (error) throw new Error(error.message);
  return paraGravar.length;
}

export async function normalizarEGravarVideo(
  supabaseAdmin: SupabaseClient,
  linhas: MetaInsightRow[],
  accountId: string | null
): Promise<number> {
  if (linhas.length === 0) return 0;

  const linhasNormalizadas = linhas.map((linha) => ({
    platform: 'meta_ads',
    campaign_id: linha.campaign_id ?? '',
    ad_id: linha.ad_id ?? null,
    date: paraDataSaoPaulo(linha.date_start ?? new Date().toISOString()),
    plays_3s: somarValorAcao(linha.video_play_actions, 'video_view'),
    thruplay: somarValorAcao(linha.video_thruplay_watched_actions, 'video_view'),
    video_p25: somarValorAcao(linha.video_p25_watched_actions, 'video_view'),
    video_p50: somarValorAcao(linha.video_p50_watched_actions, 'video_view'),
    video_p75: somarValorAcao(linha.video_p75_watched_actions, 'video_view'),
    video_p100: somarValorAcao(linha.video_p100_watched_actions, 'video_view'),
    account_id: accountId,
  }));

  const { min, max } = intervaloDeDatas(linhasNormalizadas.map((linha) => linha.date));
  let consultaExistentes = supabaseAdmin
    .from('ad_video_metrics_daily')
    .select('platform, campaign_id, ad_id, date, account_id, plays_3s, thruplay, video_p25, video_p50, video_p75, video_p100')
    .eq('platform', 'meta_ads')
    .gte('date', min)
    .lte('date', max);
  consultaExistentes = accountId ? consultaExistentes.eq('account_id', accountId) : consultaExistentes.is('account_id', null);

  const { data: existentes, error: erroExistentes } = await consultaExistentes;
  if (erroExistentes) throw new Error(erroExistentes.message);

  const paraGravar = linhasParaGravar(
    linhasNormalizadas,
    existentes ?? [],
    ['platform', 'campaign_id', 'ad_id', 'date', 'account_id'],
    ['plays_3s', 'thruplay', 'video_p25', 'video_p50', 'video_p75', 'video_p100']
  );
  if (paraGravar.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('ad_video_metrics_daily')
    .upsert(paraGravar, { onConflict: 'platform,campaign_id,ad_id,date,account_id' });

  if (error) throw new Error(error.message);
  return paraGravar.length;
}
