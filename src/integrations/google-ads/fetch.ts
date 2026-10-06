import type { GoogleAdsCredentials } from './auth.js';
import { extrairIdDaPlanilha, buscarAba, parseNumeroPlanilha, parseDataPlanilha } from '../googleSheetsCsv.js';

interface GoogleAdsRow {
  [chave: string]: unknown;
}

function normalizarCustomerId(id: string): string {
  return id.replace(/-/g, '').trim();
}

/**
 * Lê uma aba da planilha escrita pelo Google Ads Script (ver
 * googleAdsScriptTemplate.ts) e filtra por Customer ID + janela de datas. As
 * colunas de cada aba espelham as consultas GAQL do próprio script — ao mudar
 * uma, atualize a outra.
 */
async function lerAbaFiltrada(
  credenciais: GoogleAdsCredentials,
  nomeAba: string,
  sinceDate: string,
  untilDate: string
): Promise<Record<string, string>[]> {
  const sheetId = extrairIdDaPlanilha(credenciais.sheetsUrl);
  if (!sheetId) throw new Error('Google Ads: URL da planilha inválida');

  const customerIdAlvo = credenciais.customerId ? normalizarCustomerId(credenciais.customerId) : null;
  const linhas = await buscarAba(sheetId, nomeAba);

  return linhas.filter((linha) => {
    if (customerIdAlvo && linha.customer_id && normalizarCustomerId(linha.customer_id) !== customerIdAlvo) return false;
    const data = parseDataPlanilha(linha.date) ?? linha.date;
    return data >= sinceDate && data <= untilDate;
  });
}

/**
 * Performance por campanha/conjunto/anúncio, cliques/impressões/custo — aba "Performance".
 * Nem toda campanha tem "conjunto de anúncio" (ex: Performance Max) — os
 * campos vêm vazios na planilha nesses casos, tratado como null em normalize.ts.
 */
export async function buscarPerformance(credenciais: GoogleAdsCredentials, sinceDate: string, untilDate: string): Promise<GoogleAdsRow[]> {
  const linhas = await lerAbaFiltrada(credenciais, 'Performance', sinceDate, untilDate);
  return linhas.map((linha) => ({
    campaign: { id: linha.campaign_id, name: linha.campaign_name || undefined },
    adGroup: { id: linha.adgroup_id || undefined, name: linha.adgroup_name || undefined },
    adGroupAd: { ad: { id: linha.ad_id || undefined, name: linha.ad_name || undefined } },
    segments: { date: parseDataPlanilha(linha.date) ?? linha.date },
    metrics: {
      impressions: String(parseNumeroPlanilha(linha.impressions)),
      clicks: String(parseNumeroPlanilha(linha.clicks)),
      costMicros: String(parseNumeroPlanilha(linha.cost_micros)),
      conversions: String(parseNumeroPlanilha(linha.conversions)),
    },
  }));
}

/** Conversões nomeadas — aba "Conversoes". O Google Ads não entrega isso na mesma consulta de cliques/impressões. */
export async function buscarConversoesNomeadas(
  credenciais: GoogleAdsCredentials,
  sinceDate: string,
  untilDate: string
): Promise<GoogleAdsRow[]> {
  const linhas = await lerAbaFiltrada(credenciais, 'Conversoes', sinceDate, untilDate);
  return linhas.map((linha) => ({
    campaign: { id: linha.campaign_id, name: linha.campaign_name || undefined },
    adGroup: { id: linha.adgroup_id || undefined, name: linha.adgroup_name || undefined },
    segments: {
      date: parseDataPlanilha(linha.date) ?? linha.date,
      conversionActionName: linha.conversion_action_name || undefined,
    },
    metrics: {
      conversions: String(parseNumeroPlanilha(linha.conversions)),
      conversionsValue: linha.conversions_value ? String(parseNumeroPlanilha(linha.conversions_value)) : undefined,
    },
  }));
}

/** Palavra-chave/termo de pesquisa — aba "PalavrasChave". Palavras-chave negativas já ficam de fora (filtro aplicado pelo Script). */
export async function buscarPalavrasChave(
  credenciais: GoogleAdsCredentials,
  sinceDate: string,
  untilDate: string
): Promise<GoogleAdsRow[]> {
  const linhas = await lerAbaFiltrada(credenciais, 'PalavrasChave', sinceDate, untilDate);

  // ad_keyword_performance_daily não tem grupo de anúncios no grão: o mesmo
  // termo em 2 grupos da campanha vira a mesma chave, e o upsert recusa o lote
  // inteiro ("cannot affect row a second time"). Soma as linhas repetidas.
  const agrupadas = new Map<string, { linha: Record<string, string>; data: string; clicks: number; impressions: number; costMicros: number }>();
  for (const linha of linhas) {
    const data = parseDataPlanilha(linha.date) ?? linha.date;
    const chave = [linha.campaign_id, data, linha.keyword, linha.search_term].join('\u0000');
    const acumulada = agrupadas.get(chave) ?? { linha, data, clicks: 0, impressions: 0, costMicros: 0 };
    acumulada.clicks += parseNumeroPlanilha(linha.clicks);
    acumulada.impressions += parseNumeroPlanilha(linha.impressions);
    acumulada.costMicros += parseNumeroPlanilha(linha.cost_micros);
    agrupadas.set(chave, acumulada);
  }

  return Array.from(agrupadas.values()).map(({ linha, data, clicks, impressions, costMicros }) => ({
    campaign: { id: linha.campaign_id, name: linha.campaign_name || undefined },
    segments: {
      date: data,
      keyword: linha.keyword ? { info: { text: linha.keyword } } : undefined,
      searchTermView: linha.search_term ? { searchTerm: linha.search_term } : undefined,
    },
    metrics: {
      clicks: String(clicks),
      impressions: String(impressions),
      costMicros: String(costMicros),
    },
  }));
}

/** Pares Customer ID/nome encontrados na planilha — usado na etapa de seleção de conta (ver AssetSelectionDialog). */
export async function listarContasDisponiveis(
  credenciais: Pick<GoogleAdsCredentials, 'sheetsUrl'>
): Promise<Array<{ externalId: string; name: string }>> {
  const sheetId = extrairIdDaPlanilha(credenciais.sheetsUrl);
  if (!sheetId) throw new Error('Google Ads: URL da planilha inválida');

  const linhas = await buscarAba(sheetId, 'Performance');
  const vistos = new Map<string, string>();
  for (const linha of linhas) {
    const id = linha.customer_id ? normalizarCustomerId(linha.customer_id) : '';
    if (!id || vistos.has(id)) continue;
    vistos.set(id, linha.customer_name || id);
  }
  return Array.from(vistos.entries()).map(([externalId, name]) => ({ externalId, name }));
}
