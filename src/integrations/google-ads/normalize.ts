import type { SupabaseClient } from '@supabase/supabase-js';
import { paraDataSaoPaulo } from '../timezone.js';
import { resolverRegioesDasCampanhas } from '../regionResolver.js';

interface GoogleAdsRow {
  campaign?: { id?: string; name?: string };
  adGroup?: { id?: string; name?: string };
  adGroupAd?: { ad?: { id?: string; name?: string } };
  segments?: {
    date?: string;
    conversionActionName?: string;
    keyword?: { info?: { text?: string } };
    searchTermView?: { searchTerm?: string };
  };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: string;
    conversionsValue?: string;
  };
}

const MICROS_POR_UNIDADE = 1_000_000;

export async function normalizarEGravarPerformance(
  supabaseAdmin: SupabaseClient,
  linhas: GoogleAdsRow[]
): Promise<number> {
  if (linhas.length === 0) return 0;

  const regioes = await resolverRegioesDasCampanhas(supabaseAdmin, 'google_ads');

  const linhasNormalizadas = linhas.map((linha) => {
    const campaignId = linha.campaign?.id ?? '';

    return {
      platform: 'google_ads',
      campaign_id: campaignId,
      campaign_name: linha.campaign?.name ?? null,
      // Performance Max não tem ad group/ad — fica null, nunca derruba a sincronização.
      adset_id: linha.adGroup?.id ?? null,
      adset_name: linha.adGroup?.name ?? null,
      ad_id: linha.adGroupAd?.ad?.id ?? null,
      ad_name: linha.adGroupAd?.ad?.name ?? null,
      date: paraDataSaoPaulo(linha.segments?.date ?? new Date().toISOString()),
      impressions: Number(linha.metrics?.impressions ?? 0),
      clicks: Number(linha.metrics?.clicks ?? 0),
      cost: Number(linha.metrics?.costMicros ?? 0) / MICROS_POR_UNIDADE,
      conversions: Number(linha.metrics?.conversions ?? 0),
      region: regioes.get(campaignId) ?? null,
    };
  });

  const { error } = await supabaseAdmin
    .from('ad_performance_daily')
    .upsert(linhasNormalizadas, { onConflict: 'platform,campaign_id,adset_id,ad_id,date' });

  if (error) throw new Error(error.message);
  return linhasNormalizadas.length;
}

export async function normalizarEGravarConversoes(
  supabaseAdmin: SupabaseClient,
  linhas: GoogleAdsRow[]
): Promise<number> {
  if (linhas.length === 0) return 0;

  const regioes = await resolverRegioesDasCampanhas(supabaseAdmin, 'google_ads');

  const linhasNormalizadas = linhas
    .filter((linha) => linha.segments?.conversionActionName)
    .map((linha) => {
      const campaignId = linha.campaign?.id ?? '';

      return {
        platform: 'google_ads',
        campaign_id: campaignId,
        campaign_name: linha.campaign?.name ?? null,
        adset_id: linha.adGroup?.id ?? null,
        adset_name: linha.adGroup?.name ?? null,
        date: paraDataSaoPaulo(linha.segments?.date ?? new Date().toISOString()),
        conversion_name: linha.segments!.conversionActionName!,
        conversions: Number(linha.metrics?.conversions ?? 0),
        conversion_value: linha.metrics?.conversionsValue ? Number(linha.metrics.conversionsValue) : null,
        region: regioes.get(campaignId) ?? null,
      };
    });

  const { error } = await supabaseAdmin
    .from('ad_conversions_daily')
    .upsert(linhasNormalizadas, { onConflict: 'platform,campaign_id,adset_id,conversion_name,date' });

  if (error) throw new Error(error.message);
  return linhasNormalizadas.length;
}

export async function normalizarEGravarPalavrasChave(
  supabaseAdmin: SupabaseClient,
  linhas: GoogleAdsRow[]
): Promise<number> {
  if (linhas.length === 0) return 0;

  const linhasNormalizadas = linhas
    .filter((linha) => linha.segments?.keyword?.info?.text)
    .map((linha) => {
      const cliques = Number(linha.metrics?.clicks ?? 0);
      const custo = Number(linha.metrics?.costMicros ?? 0) / MICROS_POR_UNIDADE;

      return {
        campaign_id: linha.campaign?.id ?? '',
        campaign_name: linha.campaign?.name ?? null,
        date: paraDataSaoPaulo(linha.segments?.date ?? new Date().toISOString()),
        keyword: linha.segments!.keyword!.info!.text!,
        search_term: linha.segments?.searchTermView?.searchTerm ?? null,
        clicks: cliques,
        impressions: Number(linha.metrics?.impressions ?? 0),
        cost: custo,
        cpc: cliques > 0 ? custo / cliques : null,
        region: null, // resolvido só a nível de campanha nas outras tabelas; aqui é referência de termo de busca
      };
    });

  const { error } = await supabaseAdmin
    .from('ad_keyword_performance_daily')
    .upsert(linhasNormalizadas, { onConflict: 'campaign_id,keyword,search_term,date' });

  if (error) throw new Error(error.message);
  return linhasNormalizadas.length;
}
