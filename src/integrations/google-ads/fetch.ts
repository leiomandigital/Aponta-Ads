import type { GoogleAdsCredentials } from './auth.js';

// Confirme esta versão contra https://developers.google.com/google-ads/api/docs/release-notes
// antes de cada deploy — a Google Ads API descontinua versões antigas periodicamente.
const GOOGLE_ADS_API_VERSION = 'v17';

interface GoogleAdsRow {
  [chave: string]: unknown;
}

async function executarConsultaGAQL(
  credenciais: GoogleAdsCredentials,
  gaql: string
): Promise<GoogleAdsRow[]> {
  const resposta = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${credenciais.customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credenciais.accessToken}`,
        'developer-token': credenciais.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: gaql }),
    }
  );

  if (!resposta.ok) {
    throw new Error(`Google Ads: consulta GAQL falhou (HTTP ${resposta.status})`);
  }

  const lotes = (await resposta.json()) as Array<{ results?: GoogleAdsRow[] }>;
  return lotes.flatMap((lote) => lote.results ?? []);
}

/**
 * Performance por campanha/conjunto/anúncio, cliques/impressões/custo.
 * Nem toda campanha tem "conjunto de anúncio" (ex: Performance Max) — o
 * campo ad_group vem ausente nesses casos, tratado como null em normalize.ts.
 */
export async function buscarPerformance(credenciais: GoogleAdsCredentials, sinceDate: string, untilDate: string) {
  const gaql = `
    SELECT
      campaign.id, campaign.name,
      ad_group.id, ad_group.name,
      ad_group_ad.ad.id, ad_group_ad.ad.name,
      segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM ad_group_ad
    WHERE segments.date >= '${sinceDate}' AND segments.date <= '${untilDate}'
  `;
  return executarConsultaGAQL(credenciais, gaql);
}

/** Conversões nomeadas — o Google Ads não entrega isso na mesma consulta de cliques/impressões. */
export async function buscarConversoesNomeadas(credenciais: GoogleAdsCredentials, sinceDate: string, untilDate: string) {
  const gaql = `
    SELECT
      campaign.id, campaign.name,
      ad_group.id, ad_group.name,
      segments.date, segments.conversion_action_name,
      metrics.conversions, metrics.conversions_value
    FROM ad_group
    WHERE segments.date >= '${sinceDate}' AND segments.date <= '${untilDate}'
  `;
  return executarConsultaGAQL(credenciais, gaql);
}

/** Palavra-chave/termo de pesquisa. Palavras-chave negativas ficam de fora (decisão da reunião de kickoff). */
export async function buscarPalavrasChave(credenciais: GoogleAdsCredentials, sinceDate: string, untilDate: string) {
  const gaql = `
    SELECT
      campaign.id, campaign.name,
      segments.date, segments.keyword.info.text, segments.search_term_view.search_term,
      metrics.clicks, metrics.impressions, metrics.cost_micros
    FROM search_term_view
    WHERE segments.date >= '${sinceDate}' AND segments.date <= '${untilDate}'
      AND ad_group_criterion.negative = false
  `;
  return executarConsultaGAQL(credenciais, gaql);
}
