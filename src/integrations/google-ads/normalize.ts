import type { SupabaseClient } from '@supabase/supabase-js';
import { paraDataSaoPaulo } from '../timezone.js';
import { resolverRegioesDasCampanhas } from '../regionResolver.js';
import { intervaloDeDatas, linhasParaGravar } from '../diffUpsert.js';

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
  linhas: GoogleAdsRow[],
  accountId: string | null
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
      account_id: accountId,
    };
  });

  const { min, max } = intervaloDeDatas(linhasNormalizadas.map((linha) => linha.date));
  let consultaExistentes = supabaseAdmin
    .from('ad_performance_daily')
    .select('platform, campaign_id, adset_id, ad_id, date, account_id, campaign_name, adset_name, ad_name, impressions, clicks, cost, conversions, region')
    .eq('platform', 'google_ads')
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

export async function normalizarEGravarConversoes(
  supabaseAdmin: SupabaseClient,
  linhas: GoogleAdsRow[],
  accountId: string | null
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
        account_id: accountId,
      };
    });

  if (linhasNormalizadas.length === 0) return 0;

  const { min, max } = intervaloDeDatas(linhasNormalizadas.map((linha) => linha.date));
  let consultaExistentes = supabaseAdmin
    .from('ad_conversions_daily')
    .select('platform, campaign_id, adset_id, conversion_name, date, account_id, campaign_name, adset_name, conversions, conversion_value, region')
    .eq('platform', 'google_ads')
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

export async function normalizarEGravarPalavrasChave(
  supabaseAdmin: SupabaseClient,
  linhas: GoogleAdsRow[],
  accountId: string | null
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
        account_id: accountId,
      };
    });

  if (linhasNormalizadas.length === 0) return 0;

  const { min, max } = intervaloDeDatas(linhasNormalizadas.map((linha) => linha.date));
  // Sem coluna platform — a tabela só é gravada pelo conector do Google Ads, então account_id sozinho já isola a linha certa (ver diffUpsert.ts).
  let consultaExistentes = supabaseAdmin
    .from('ad_keyword_performance_daily')
    .select('campaign_id, keyword, search_term, date, account_id, campaign_name, clicks, impressions, cost, cpc, region')
    .gte('date', min)
    .lte('date', max);
  consultaExistentes = accountId ? consultaExistentes.eq('account_id', accountId) : consultaExistentes.is('account_id', null);

  const { data: existentes, error: erroExistentes } = await consultaExistentes;
  if (erroExistentes) throw new Error(erroExistentes.message);

  const paraGravar = linhasParaGravar(
    linhasNormalizadas,
    existentes ?? [],
    ['campaign_id', 'keyword', 'search_term', 'date', 'account_id'],
    ['campaign_name', 'clicks', 'impressions', 'cost', 'cpc', 'region']
  );
  if (paraGravar.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('ad_keyword_performance_daily')
    .upsert(paraGravar, { onConflict: 'campaign_id,keyword,search_term,date,account_id' });

  if (error) throw new Error(error.message);
  return paraGravar.length;
}
