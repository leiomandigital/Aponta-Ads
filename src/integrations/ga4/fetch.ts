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
  filtroDimensao?: Record<string, unknown>,
  dimensoes: Array<{ name: string }> = DIMENSOES
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
          dimensions: dimensoes,
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

export type TipoDetalhamentoLead = 'caminho' | 'origem' | 'idade' | 'genero' | 'local' | 'retorno' | 'tempo';

// Primeira dimensão sempre `date` (grão diário); as demais são as dim1/dim2/dim3 gravadas em
// analytics_lead_breakdown_daily. Ver migration 046.
const CONSULTAS_DETALHAMENTO_LEAD: Array<{ tipo: TipoDetalhamentoLead; dimensoes: string[] }> = [
  { tipo: 'caminho', dimensoes: ['landingPage', 'pagePath', 'pageReferrer'] }, // entrada, cadastro, página anterior
  { tipo: 'origem', dimensoes: ['sessionSource', 'sessionMedium'] },
  { tipo: 'idade', dimensoes: ['userAgeBracket'] },
  { tipo: 'genero', dimensoes: ['userGender'] },
  { tipo: 'local', dimensoes: ['region', 'city'] },
  { tipo: 'retorno', dimensoes: ['newVsReturning'] },
  { tipo: 'tempo', dimensoes: ['firstSessionDate'] },
];

export type ResultadoDetalhamentoLead =
  | { tipo: TipoDetalhamentoLead; ok: true; linhas: GA4Row[] }
  | { tipo: TipoDetalhamentoLead; ok: false; erro: string };

/**
 * Leads (generate_lead) quebrados por dimensão da jornada — cada dimensão é uma consulta
 * própria e falha isolada: idade/gênero exigem Google Signals e podem voltar erro/vazio
 * sem derrubar caminho, origem etc.
 */
export function buscarDetalhamentoLeads(
  credenciais: GA4Credentials,
  sinceDate: string,
  untilDate: string
): Promise<ResultadoDetalhamentoLead[]> {
  const filtroLead = { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: EVENTO_LEAD } } };

  const consultar = (tipo: TipoDetalhamentoLead, dimensoes: string[]) =>
    executarRelatorio(
      credenciais,
      sinceDate,
      untilDate,
      [{ name: 'eventCount' }],
      `leads por ${tipo}`,
      filtroLead,
      [{ name: 'date' }, ...dimensoes.map((name) => ({ name }))]
    );

  return Promise.all(
    CONSULTAS_DETALHAMENTO_LEAD.map(({ tipo, dimensoes }) =>
      // A 3ª dimensão do caminho (pageReferrer) é opcional: se o GA4 recusar essa combinação,
      // refaz só com entrada + cadastro em vez de perder o card inteiro.
      (tipo === 'caminho' ? consultar(tipo, dimensoes).catch(() => consultar(tipo, dimensoes.slice(0, 2))) : consultar(tipo, dimensoes)).then(
        (linhas): ResultadoDetalhamentoLead => ({ tipo, ok: true, linhas }),
        (erro): ResultadoDetalhamentoLead => ({ tipo, ok: false, erro: erro instanceof Error ? erro.message : 'falha desconhecida' })
      )
    )
  );
}

interface GA4PropertySummary {
  property: string; // formato "properties/123456789"
  displayName: string;
}

interface GA4AccountSummary {
  propertySummaries?: GA4PropertySummary[];
}

/**
 * Lista as propriedades GA4 visíveis para a service account, via Admin API
 * (mesmo escopo analytics.readonly já pedido em auth.ts — não exige consentimento
 * novo). Usada pela tela de seleção de ativos, para trocar o campo de texto
 * livre de propertyId por um seletor com as propriedades reais.
 */
export async function listarPropriedadesDisponiveis(
  credenciais: GA4Credentials
): Promise<Array<{ externalId: string; name: string }>> {
  const resposta = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { Authorization: `Bearer ${credenciais.accessToken}` },
  });

  if (!resposta.ok) {
    throw new Error(`GA4: consulta de propriedades disponíveis falhou (HTTP ${resposta.status})`);
  }

  const corpo = (await resposta.json()) as { accountSummaries?: GA4AccountSummary[] };

  return (corpo.accountSummaries ?? []).flatMap((conta) =>
    (conta.propertySummaries ?? []).map((propriedade) => ({
      externalId: propriedade.property.replace('properties/', ''),
      name: propriedade.displayName,
    }))
  );
}
