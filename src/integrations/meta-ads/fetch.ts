import type { MetaAdsCredentials } from './auth.js';

// Confirme esta versão contra https://developers.facebook.com/docs/graph-api/changelog
// antes de cada deploy — o Graph API descontinua versões antigas periodicamente.
const META_GRAPH_API_VERSION = 'v20.0';

// fetch() nativo não tem timeout por padrão — se a API do Meta travar sem
// responder, a função fica presa até a Vercel matar o processo à força aos
// 60s, sem nenhum log (o erro nunca chega a ser lançado). Este limite garante
// que uma trava vira um erro capturável, visível em sync_logs.
const TEMPO_LIMITE_MS = 20_000;

interface MetaInsightRow {
  [chave: string]: unknown;
}

/**
 * A API de Insights do Meta pagina os resultados — com time_increment:'1' e
 * level:'ad' numa janela de 90 dias, é comum passar de uma única página.
 * Sem seguir `paging.next`, a consulta sempre volta só com a primeira página
 * (as datas mais antigas do período), perdendo o resto sem erro nenhum.
 */
async function buscarInsights(
  credenciais: MetaAdsCredentials,
  sinceDate: string,
  untilDate: string,
  parametrosExtra: Record<string, string>
): Promise<MetaInsightRow[]> {
  const parametros = new URLSearchParams({
    access_token: credenciais.accessToken,
    time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
    time_increment: '1',
    level: 'ad',
    ...parametrosExtra,
  });

  const linhas: MetaInsightRow[] = [];
  let proximaUrl: string | undefined =
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/act_${credenciais.adAccountId}/insights?${parametros}`;

  while (proximaUrl) {
    let resposta: Response;
    try {
      resposta = await fetch(proximaUrl, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    } catch (erro) {
      const foiTimeout = erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError');
      throw new Error(
        foiTimeout
          ? `Meta Ads: consulta de insights excedeu ${TEMPO_LIMITE_MS / 1000}s sem resposta da API`
          : `Meta Ads: falha de rede na consulta de insights — ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
      );
    }

    if (!resposta.ok) {
      throw new Error(`Meta Ads: consulta de insights falhou (HTTP ${resposta.status})`);
    }

    const corpo = (await resposta.json()) as { data?: MetaInsightRow[]; paging?: { next?: string } };
    linhas.push(...(corpo.data ?? []));
    proximaUrl = corpo.paging?.next;
  }

  return linhas;
}

/** Cliques aqui = cliques no link (link_click), não clique genérico (all_clicks). */
export async function buscarPerformance(credenciais: MetaAdsCredentials, sinceDate: string, untilDate: string) {
  return buscarInsights(credenciais, sinceDate, untilDate, {
    fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,inline_link_clicks,spend',
  });
}

/** Conversões por evento — não vêm combinadas com idade/gênero na mesma chamada. */
export async function buscarConversoesPorEvento(credenciais: MetaAdsCredentials, sinceDate: string, untilDate: string) {
  return buscarInsights(credenciais, sinceDate, untilDate, {
    fields: 'campaign_id,campaign_name,adset_id,adset_name,actions,action_values',
  });
}

/** Idade/gênero — consulta separada (breakdowns não combina com o evento de conversão de forma confiável). */
export async function buscarDemografia(credenciais: MetaAdsCredentials, sinceDate: string, untilDate: string) {
  return buscarInsights(credenciais, sinceDate, untilDate, {
    fields: 'campaign_id,impressions,inline_link_clicks,spend',
    breakdowns: 'age,gender',
  });
}

/** Métricas de vídeo (ThruPlay, play de 3s, percentuais de progresso). */
export async function buscarMetricasDeVideo(credenciais: MetaAdsCredentials, sinceDate: string, untilDate: string) {
  return buscarInsights(credenciais, sinceDate, untilDate, {
    fields: 'campaign_id,ad_id,video_play_actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions',
  });
}
