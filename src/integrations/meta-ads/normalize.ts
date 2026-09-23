import type { SupabaseClient } from '@supabase/supabase-js';
import { paraDataSaoPaulo } from '../timezone.js';
import { resolverRegioesDasCampanhas } from '../regionResolver.js';

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
  linhas: MetaInsightRow[]
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
    };
  });

  const { error } = await supabaseAdmin
    .from('ad_performance_daily')
    .upsert(linhasNormalizadas, { onConflict: 'platform,campaign_id,adset_id,ad_id,date' });

  if (error) throw new Error(error.message);
  return linhasNormalizadas.length;
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
}

export async function normalizarEGravarConversoes(
  supabaseAdmin: SupabaseClient,
  linhas: MetaInsightRow[]
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
        });
      }
    }
  }

  const linhasNormalizadas = [...porChave.values()].map((linha) => ({
    ...linha,
    conversion_value: linha.conversion_value || null,
  }));

  if (linhasNormalizadas.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('ad_conversions_daily')
    .upsert(linhasNormalizadas, { onConflict: 'platform,campaign_id,adset_id,conversion_name,date' });

  if (error) throw new Error(error.message);
  return linhasNormalizadas.length;
}

export async function normalizarEGravarDemografia(
  supabaseAdmin: SupabaseClient,
  linhas: MetaInsightRow[]
): Promise<number> {
  if (linhas.length === 0) return 0;

  const regioes = await resolverRegioesDasCampanhas(supabaseAdmin, 'meta_ads');

  const linhasNormalizadas = linhas.map((linha) => {
    const campaignId = linha.campaign_id ?? '';

    return {
      platform: 'meta_ads',
      campaign_id: campaignId,
      date: paraDataSaoPaulo(linha.date_start ?? new Date().toISOString()),
      age_range: linha.age ?? null,
      gender: linha.gender ?? null,
      impressions: Number(linha.impressions ?? 0),
      clicks: Number(linha.inline_link_clicks ?? 0),
      cost: Number(linha.spend ?? 0),
      region: regioes.get(campaignId) ?? null,
    };
  });

  const { error } = await supabaseAdmin
    .from('ad_performance_demographics_daily')
    .upsert(linhasNormalizadas, { onConflict: 'platform,campaign_id,age_range,gender,date' });

  if (error) throw new Error(error.message);
  return linhasNormalizadas.length;
}

export async function normalizarEGravarVideo(
  supabaseAdmin: SupabaseClient,
  linhas: MetaInsightRow[]
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
  }));

  const { error } = await supabaseAdmin
    .from('ad_video_metrics_daily')
    .upsert(linhasNormalizadas, { onConflict: 'platform,campaign_id,ad_id,date' });

  if (error) throw new Error(error.message);
  return linhasNormalizadas.length;
}
