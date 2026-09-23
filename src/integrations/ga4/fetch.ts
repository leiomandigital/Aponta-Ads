import type { GA4Credentials } from './auth.js';

export interface GA4Row {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

/** Evento do GA4 que representa um lead — enviado pelo site (ou criado no próprio GA4). */
const EVENTO_LEAD = 'generate_lead';

// Mesmas dimensões nas duas consultas, para as linhas de leads casarem com as de sessões.
const DIMENSOES = [
  { name: 'date' },
  { name: 'pagePath' },
  { name: 'deviceCategory' },
  { name: 'sessionDefaultChannelGroup' },
];

// A Data API do GA4 pagina por limit/offset (não por cursor) e devolve, junto
// com as linhas, `rowCount` — o total real de linhas que a consulta encontrou,
// não só as desta página. Sem seguir isso, uma propriedade com bastante
// tráfego/páginas distintas perderia dado silenciosamente a partir da
// primeira página (mesma classe de bug já encontrada e corrigida no Meta Ads).
const TAMANHO_PAGINA_GA4 = 100000;

async function executarRelatorio(
  credenciais: GA4Credentials,
  sinceDate: string,
  untilDate: string,
  metricas: Array<{ name: string }>,
  rotulo: string,
  filtroDimensao?: Record<string, unknown>
): Promise<GA4Row[]> {
  const linhas: GA4Row[] = [];
  let offset = 0;
  let totalLinhas = Infinity;

  while (offset < totalLinhas) {
    const resposta = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${credenciais.propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credenciais.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: sinceDate, endDate: untilDate }],
          dimensions: DIMENSOES,
          metrics: metricas,
          limit: TAMANHO_PAGINA_GA4,
          offset,
          ...(filtroDimensao ? { dimensionFilter: filtroDimensao } : {}),
        }),
      }
    );

    if (!resposta.ok) {
      throw new Error(`GA4: consulta de ${rotulo} ao Data API falhou (HTTP ${resposta.status})`);
    }

    const corpo = (await resposta.json()) as { rows?: GA4Row[]; rowCount?: number };
    const paginaAtual = corpo.rows ?? [];

    linhas.push(...paginaAtual);
    totalLinhas = corpo.rowCount ?? linhas.length;
    offset += TAMANHO_PAGINA_GA4;

    if (paginaAtual.length === 0) break; // segurança contra loop infinito se rowCount vier inconsistente
  }

  return linhas;
}

/**
 * O GA4 Data API permite combinar página, dispositivo e tipo de tráfego numa
 * única consulta — sem precisar fatiar em tabelas separadas como Google Ads/Meta
 * Ads (ver Integration Connector Pattern Skill, seção 5).
 *
 * Idade e gênero (userAgeBracket/userGender) ficam de fora: em propriedades sem
 * dados demográficos (Google Signals inativo ou abaixo do limite de privacidade)
 * a consulta inteira volta vazia. age_range/gender ficam null em
 * analytics_sessions_daily.
 */
export function buscarSessoes(credenciais: GA4Credentials, sinceDate: string, untilDate: string): Promise<GA4Row[]> {
  return executarRelatorio(credenciais, sinceDate, untilDate, [{ name: 'sessions' }, { name: 'totalUsers' }], 'sessões');
}

/**
 * Consulta separada porque filtrar por eventName restringe todas as métricas
 * da consulta — não dá para pedir sessões e leads juntos.
 */
export function buscarLeads(credenciais: GA4Credentials, sinceDate: string, untilDate: string): Promise<GA4Row[]> {
  return executarRelatorio(credenciais, sinceDate, untilDate, [{ name: 'eventCount' }], 'leads', {
    filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: EVENTO_LEAD } },
  });
}
