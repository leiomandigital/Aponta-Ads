import type { AggregatedMetrics, CampaignCostEntry, CostBreakdown } from '../types/database.types.js';

interface LinhaMidiaAgregavel {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

interface LinhaAnalyticsAgregavel {
  sessions: number;
  users: number;
  leads: number;
}

// Funções puras, sem dependência de Supabase — reaproveitadas pelo
// dashboardService (client, browser) e pela geração do PDF (server,
// api/export/pdf.ts). CPM/CTR/CPC nunca são gravados como coluna: são
// razões, sempre calculadas aqui a partir da soma de impressions/clicks/cost
// no escopo exibido. Nunca fazer AVG(cpm) entre linhas — distorce o resultado.
export function calcularMetricasAgregadas(linhas: LinhaMidiaAgregavel[]): AggregatedMetrics {
  const totais = linhas.reduce(
    (acumulado, linha) => ({
      impressions: acumulado.impressions + linha.impressions,
      clicks: acumulado.clicks + linha.clicks,
      cost: acumulado.cost + linha.cost,
      conversions: acumulado.conversions + linha.conversions,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
  );

  return {
    ...totais,
    cpm: totais.impressions > 0 ? (totais.cost / totais.impressions) * 1000 : null,
    ctr: totais.impressions > 0 ? totais.clicks / totais.impressions : null,
    cpc: totais.clicks > 0 ? totais.cost / totais.clicks : null,
    cpa: totais.conversions > 0 ? totais.cost / totais.conversions : null,
  };
}

/**
 * CPM, CPC e custo/conversão sobre o CUSTO TOTAL (mídia + taxas + avulsos) em vez do custo de mídia
 * — mesma base do card "Custo total", do custo/conversão e do custo por lead.
 */
export function aplicarCustoTotalNasMetricas<T extends Pick<AggregatedMetrics, 'impressions' | 'clicks' | 'conversions' | 'cpm' | 'cpc'>>(
  metricas: T,
  custoTotal: number
): T & { cpa: number | null } {
  return {
    ...metricas,
    cpm: metricas.impressions > 0 ? (custoTotal / metricas.impressions) * 1000 : null,
    cpc: metricas.clicks > 0 ? custoTotal / metricas.clicks : null,
    cpa: metricas.conversions > 0 ? custoTotal / metricas.conversions : null,
  };
}

/** Agrupa linhas de ad_performance_daily por data — usado nos gráficos de mídia paga (app e PDF). */
export function agruparMidiaPorDia<T extends LinhaMidiaAgregavel & { date: string }>(linhas: T[]) {
  const porDia = new Map<string, LinhaMidiaAgregavel>();

  for (const linha of linhas) {
    const acumulado = porDia.get(linha.date) ?? { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
    porDia.set(linha.date, {
      impressions: acumulado.impressions + linha.impressions,
      clicks: acumulado.clicks + linha.clicks,
      cost: acumulado.cost + linha.cost,
      conversions: acumulado.conversions + linha.conversions,
    });
  }

  return Array.from(porDia.entries())
    .map(([date, metrica]) => ({ date, ...metrica, ...calcularMetricasAgregadas([metrica]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Agrupa linhas de mídia paga por uma chave arbitrária (campanha, conjunto de
 * anúncio ou anúncio), somando impressions/clicks/cost/conversions e
 * recalculando CPM/CTR/CPC sobre o total do grupo — nunca por linha.
 * `extrasDe` define os campos de identificação (nome, id do pai) que cada
 * linha do grupo carrega consigo, mantidos da primeira linha encontrada.
 */
export function agruparMidiaPorChave<T extends LinhaMidiaAgregavel>(
  linhas: T[],
  chaveDe: (linha: T) => string,
  extrasDe: (linha: T) => Record<string, unknown>
) {
  const porChave = new Map<string, LinhaMidiaAgregavel & Record<string, unknown>>();

  for (const linha of linhas) {
    const chave = chaveDe(linha);
    const acumulado = porChave.get(chave) ?? { ...extrasDe(linha), impressions: 0, clicks: 0, cost: 0, conversions: 0 };
    porChave.set(chave, {
      ...acumulado,
      impressions: acumulado.impressions + linha.impressions,
      clicks: acumulado.clicks + linha.clicks,
      cost: acumulado.cost + linha.cost,
      conversions: acumulado.conversions + linha.conversions,
    });
  }

  return Array.from(porChave.values()).map((linha) => ({ ...linha, ...calcularMetricasAgregadas([linha]) }));
}

// Repasse de PIS/Cofins (9,25%) + ISS (2,9%) que a Meta passou a cobrar do
// anunciante brasileiro a partir de 01/01/2026 — o valor de "spend" que a API
// de insights devolve (gravado em ad_performance_daily.cost) é sempre o
// líquido, sem o imposto; o imposto só aparece na fatura/boleto, nunca num
// campo da API. É uma alíquota fixa e pública (não varia por conta), por isso
// dá pra calcular aqui sem precisar buscar nada — não existe hoje pra
// google_ads (o Google optou por absorver o imposto em vez de repassar).
//
// A alíquota (12,15%) incide sobre o valor BRUTO cobrado, não sobre o líquido
// — por isso o fator de conversão é 1/(1-0.1215), não 1+0.1215. Validado
// contra os dois exemplos oficiais: líquido R$1.000 -> aporte bruto R$1.138,30
// (pós-pago) e aporte bruto R$1.000 -> líquido R$878,50 (pré-pago); nos dois
// casos bruto = líquido / (1 - 0.1215).
export const TAXA_PLATAFORMA_META = 0.1215;

function aplicarTaxaAutomatica(platform: string, costLiquido: number): number {
  return platform === 'meta_ads' ? costLiquido / (1 - TAXA_PLATAFORMA_META) : costLiquido;
}

interface LinhaComCusto {
  platform: string;
  cost: number;
}

/**
 * Custo em cascata: mídia (o spend líquido já gravado) → +taxa automática da
 * plataforma (ver aplicarTaxaAutomatica, só meta_ads) → +custos avulsos
 * (lançamento manual, ex: sessão de fotos do produto). `linhasMidia` precisa
 * ser por linha (não já somada) porque a taxa depende da plataforma de cada
 * uma — um total já agregado de Geral (Google + Meta) não dá pra destaxar
 * corretamente. `entradasAvulsas` já deve vir filtrada pro escopo desejado
 * (campanha/período) por quem chama.
 */
export function calcularDetalhamentoDeCusto(linhasMidia: LinhaComCusto[], entradasAvulsas: CampaignCostEntry[]): CostBreakdown {
  const costMidia = linhasMidia.reduce((soma, linha) => soma + linha.cost, 0);
  const costComTaxas = linhasMidia.reduce((soma, linha) => soma + aplicarTaxaAutomatica(linha.platform, linha.cost), 0);
  const custoAvulso = entradasAvulsas.reduce((soma, entrada) => soma + entrada.amount, 0);
  return { costMidia, costComTaxas, costTotal: costComTaxas + custoAvulso };
}

export interface ComparacaoPeriodo {
  /** Fração (0.12 = 12%) — null quando o período anterior é 0 (divisão por zero não faz sentido). */
  percentual: number | null;
  delta: number;
}

/** Compara um total do período atual com o mesmo total no período anterior de igual duração. */
export function compararComPeriodoAnterior(atual: number, anterior: number): ComparacaoPeriodo {
  return {
    percentual: anterior !== 0 ? (atual - anterior) / anterior : null,
    delta: atual - anterior,
  };
}

/** Mesmo número de dias do período informado, imediatamente antes dele — usado na comparação dos cards (app e PDF). */
export function calcularPeriodoAnterior(dataInicio: string, dataFim: string): { dataInicio: string; dataFim: string } {
  const inicio = new Date(`${dataInicio}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);
  const duracaoDias = Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1;

  const fimAnterior = new Date(inicio);
  fimAnterior.setDate(fimAnterior.getDate() - 1);
  const inicioAnterior = new Date(fimAnterior);
  inicioAnterior.setDate(inicioAnterior.getDate() - (duracaoDias - 1));

  return {
    dataInicio: inicioAnterior.toISOString().slice(0, 10),
    dataFim: fimAnterior.toISOString().slice(0, 10),
  };
}

export interface ComparacaoMetricasAgregadas {
  impressions: ComparacaoPeriodo;
  clicks: ComparacaoPeriodo;
  cost: ComparacaoPeriodo;
  conversions: ComparacaoPeriodo;
  cpm: ComparacaoPeriodo;
  ctr: ComparacaoPeriodo;
  cpc: ComparacaoPeriodo;
}

/** Compara os dois lados já agregados (calcularMetricasAgregadas) de mídia paga — app e PDF usam a mesma comparação. */
export function compararMetricasAgregadas(atual: AggregatedMetrics, anterior: AggregatedMetrics): ComparacaoMetricasAgregadas {
  return {
    impressions: compararComPeriodoAnterior(atual.impressions, anterior.impressions),
    clicks: compararComPeriodoAnterior(atual.clicks, anterior.clicks),
    cost: compararComPeriodoAnterior(atual.cost, anterior.cost),
    conversions: compararComPeriodoAnterior(atual.conversions, anterior.conversions),
    cpm: compararComPeriodoAnterior(atual.cpm ?? 0, anterior.cpm ?? 0),
    ctr: compararComPeriodoAnterior(atual.ctr ?? 0, anterior.ctr ?? 0),
    cpc: compararComPeriodoAnterior(atual.cpc ?? 0, anterior.cpc ?? 0),
  };
}

interface LinhaCustoPorLead {
  date: string;
  leads_count: number;
  total_cost: number;
}

/**
 * Agrupa vw_lead_cost_daily (já quebrada por origem) por data só, somando
 * leads e custo antes de dividir — nunca fazer média de cost_per_lead entre
 * origens, mesma regra de nunca fazer AVG(cpm) entre linhas.
 */
export function agruparCustoPorLeadPorDia<T extends LinhaCustoPorLead>(linhas: T[]) {
  const porDia = new Map<string, { leads_count: number; total_cost: number }>();

  for (const linha of linhas) {
    const acumulado = porDia.get(linha.date) ?? { leads_count: 0, total_cost: 0 };
    porDia.set(linha.date, {
      leads_count: acumulado.leads_count + linha.leads_count,
      total_cost: acumulado.total_cost + linha.total_cost,
    });
  }

  return Array.from(porDia.entries())
    .map(([date, totais]) => ({
      date,
      ...totais,
      cost_per_lead: totais.leads_count > 0 ? totais.total_cost / totais.leads_count : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Agrupa linhas de analytics_sessions_daily por data — usado nos gráficos de Analytics (app e PDF). */
export function agruparAnalyticsPorDia<T extends LinhaAnalyticsAgregavel & { date: string }>(linhas: T[]) {
  const porDia = new Map<string, LinhaAnalyticsAgregavel>();

  for (const linha of linhas) {
    const acumulado = porDia.get(linha.date) ?? { sessions: 0, users: 0, leads: 0 };
    porDia.set(linha.date, {
      sessions: acumulado.sessions + linha.sessions,
      users: acumulado.users + linha.users,
      leads: acumulado.leads + linha.leads,
    });
  }

  return Array.from(porDia.entries())
    .map(([date, metrica]) => ({ date, ...metrica }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TotaisAnalytics {
  sessions: number;
  users: number;
  leads: number;
  /** Distingue "mediu e deu zero" de "não tem nenhuma linha pra medir" — os cards usam isso pra mostrar "—" em vez de "0". */
  temDados: boolean;
}

/** Soma sessions/users/leads de analytics_sessions_daily — mesmas linhas já buscadas servem pra isso e pra agruparAnalyticsPorDia, sem consulta repetida. */
export function somarTotaisAnalytics(linhas: LinhaAnalyticsAgregavel[]): TotaisAnalytics {
  const totais = linhas.reduce(
    (acumulado, linha) => ({
      sessions: acumulado.sessions + linha.sessions,
      users: acumulado.users + linha.users,
      leads: acumulado.leads + linha.leads,
    }),
    { sessions: 0, users: 0, leads: 0 }
  );
  return { ...totais, temDados: linhas.length > 0 };
}

export interface LinhaPlataforma extends LinhaMidiaAgregavel {
  platform: string;
}

/** Soma mídia paga por plataforma (Google Ads × Meta Ads) e recalcula CTR/CPC/CPA sobre o total de cada uma. */
export function agruparMidiaPorPlataforma<T extends LinhaPlataforma>(linhas: T[]) {
  return agruparMidiaPorChave(linhas, (linha) => linha.platform, (linha) => ({ platform: linha.platform })).sort(
    (a, b) => b.cost - a.cost
  ) as unknown as Array<AggregatedMetrics & { platform: string }>;
}

interface LinhaCustoPorOrigem {
  source: string | null;
  leads_count: number;
  total_cost: number;
}

/** Agrupa vw_lead_cost_daily por origem, somando leads e custo antes de dividir (nunca média de cost_per_lead). */
export function agruparCustoPorOrigem<T extends LinhaCustoPorOrigem>(linhas: T[]) {
  const porOrigem = new Map<string, { leads_count: number; total_cost: number }>();

  for (const linha of linhas) {
    const origem = linha.source ?? '(sem origem)';
    const acumulado = porOrigem.get(origem) ?? { leads_count: 0, total_cost: 0 };
    porOrigem.set(origem, {
      leads_count: acumulado.leads_count + linha.leads_count,
      total_cost: acumulado.total_cost + linha.total_cost,
    });
  }

  return Array.from(porOrigem.entries())
    .map(([source, totais]) => ({
      source,
      ...totais,
      cost_per_lead: totais.leads_count > 0 ? totais.total_cost / totais.leads_count : null,
    }))
    .sort((a, b) => b.leads_count - a.leads_count);
}

export interface ItemDistribuicao {
  rotulo: string;
  total: number;
}

/**
 * Item sem a informação ainda entra na contagem (continua sendo um lead
 * real do período) — só não ganha rótulo inventado tipo "(sem origem)": o
 * rótulo fica vazio, a barra e o número aparecem normalmente. String vazia
 * ('') conta como ausência igual a null: RD Station grava source: '' (nunca
 * null, ver resolverSource em rd-station/normalize.ts) pra não quebrar o
 * índice único de dedupe — os dois têm que cair no mesmo grupo "sem rótulo".
 */
function contarPor<T>(itens: T[], rotuloDe: (item: T) => string | null): ItemDistribuicao[] {
  const contagem = new Map<string, number>();
  for (const item of itens) {
    const bruto = rotuloDe(item);
    const rotulo = bruto && bruto.trim() ? bruto : '';
    contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
  }
  return Array.from(contagem.entries())
    .map(([rotulo, total]) => ({ rotulo, total }))
    .sort((a, b) => b.total - a.total);
}

export interface LinhaLeadParaDistribuicao {
  source: string | null;
  funnel_stage: string | null;
  region: string | null;
  event_identifier?: string | null;
}

export interface DistribuicaoDeLeads {
  total: number;
  porOrigem: ItemDistribuicao[];
  porEtapa: ItemDistribuicao[];
  porRegiao: ItemDistribuicao[];
  /** Leads por identificador de conversão do RD Station (o formulário); '' = lead sem formulário registrado. */
  porFormulario: ItemDistribuicao[];
}

export const DISTRIBUICAO_VAZIA: DistribuicaoDeLeads = { total: 0, porOrigem: [], porEtapa: [], porRegiao: [], porFormulario: [] };

/** Conta leads por origem, etapa do funil e região — sem nunca carregar nome/e-mail. */
export function distribuirLeads(leads: LinhaLeadParaDistribuicao[]): DistribuicaoDeLeads {
  return {
    total: leads.length,
    porOrigem: contarPor(leads, (lead) => lead.source),
    porEtapa: contarPor(leads, (lead) => lead.funnel_stage),
    porRegiao: contarPor(leads, (lead) => lead.region),
    porFormulario: contarPor(leads, (lead) => lead.event_identifier ?? null),
  };
}

export interface ItemDistribuicaoComComparacao extends ItemDistribuicao {
  comparacao: ComparacaoPeriodo;
}

/**
 * Compara cada item do período atual com o item de mesmo rótulo no período
 * anterior — item que não existia antes vira "novo" (percentual null, mesma
 * regra de compararComPeriodoAnterior). Item que só existia antes e sumiu
 * agora não aparece (a lista é sempre a do período atual, igual campanhas
 * com custo zero também não aparecem na tabela de campanhas).
 */
export function compararDistribuicoes(atual: ItemDistribuicao[], anterior: ItemDistribuicao[]): ItemDistribuicaoComComparacao[] {
  const totalPorRotuloAnterior = new Map(anterior.map((item) => [item.rotulo, item.total]));
  return atual.map((item) => ({
    ...item,
    comparacao: compararComPeriodoAnterior(item.total, totalPorRotuloAnterior.get(item.rotulo) ?? 0),
  }));
}

interface LinhaSessaoDetalhada {
  sessions: number;
  users: number;
  leads?: number;
  /** A view diária do GA4 (vw_analytics_sessions_diario) não traz página — só dia e dispositivo. */
  page_path?: string | null;
  device: string | null;
}

export interface LinhaPaginaAgregada {
  page_path: string;
  sessions: number;
  users: number;
}

export interface LinhaDispositivoAgregada {
  device: string;
  sessions: number;
  users: number;
  leads: number;
}

const LIMITE_PAGINAS = 10;

/** Top páginas por sessões e sessões por dispositivo, derivados das mesmas linhas de analytics_sessions_daily. */
export function agruparSessoesPorPaginaEDispositivo(linhas: LinhaSessaoDetalhada[]) {
  const paginas = new Map<string, LinhaPaginaAgregada>();
  const dispositivos = new Map<string, LinhaDispositivoAgregada>();

  for (const linha of linhas) {
    const pagina = linha.page_path ?? '(não identificada)';
    const p = paginas.get(pagina) ?? { page_path: pagina, sessions: 0, users: 0 };
    paginas.set(pagina, { page_path: pagina, sessions: p.sessions + linha.sessions, users: p.users + linha.users });

    const dispositivo = linha.device ?? '(não identificado)';
    const d = dispositivos.get(dispositivo) ?? { device: dispositivo, sessions: 0, users: 0, leads: 0 };
    dispositivos.set(dispositivo, {
      device: dispositivo,
      sessions: d.sessions + linha.sessions,
      users: d.users + linha.users,
      leads: d.leads + (linha.leads ?? 0),
    });
  }

  return {
    paginas: Array.from(paginas.values())
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, LIMITE_PAGINAS),
    dispositivos: Array.from(dispositivos.values()).sort((a, b) => b.sessions - a.sessions),
  };
}

export interface LinhaDetalhamentoLead {
  kind: string;
  dim1: string | null;
  dim2: string | null;
  dim3?: string | null;
  leads: number;
}

export interface CaminhoLead {
  entrada: string;
  /** Página visitada logo antes do cadastro (pageReferrer); null quando igual à entrada/cadastro ou desconhecida. */
  anterior: string | null;
  cadastro: string;
  leads: number;
}

export interface JornadaDoLead {
  /** Maior total entre as dimensões — cada uma cobre o mesmo evento, mas o GA4 pode omitir linhas (limiar de privacidade). */
  totalLeads: number;
  caminhos: CaminhoLead[];
  origens: ItemDistribuicao[];
  idade: ItemDistribuicao[];
  genero: ItemDistribuicao[];
  local: ItemDistribuicao[];
  retorno: ItemDistribuicao[];
  /** Média de dias entre a 1ª visita e o lead; null sem dado. */
  mediaDiasAteConverter: number | null;
  faixasTempo: ItemDistribuicao[];
  /** Fração de leads de usuários novos (1ª visita no dia do lead ou sem visita anterior); null sem dado. */
  fracaoNovos: number | null;
  temDados: boolean;
}

export const JORNADA_VAZIA: JornadaDoLead = {
  totalLeads: 0,
  caminhos: [],
  origens: [],
  idade: [],
  genero: [],
  local: [],
  retorno: [],
  mediaDiasAteConverter: null,
  faixasTempo: [],
  fracaoNovos: null,
  temDados: false,
};

const NAO_IDENTIFICADO = '(não identificado)';
const ROTULO_GENERO: Record<string, string> = { female: 'Feminino', male: 'Masculino', unknown: 'Não informado' };
const ROTULO_RETORNO: Record<string, string> = { new: 'Novos', returning: 'Recorrentes' };
const FAIXAS_TEMPO: Array<{ rotulo: string; ate: number }> = [
  { rotulo: 'No mesmo dia', ate: 0 },
  { rotulo: '1 a 3 dias', ate: 3 },
  { rotulo: '4 a 7 dias', ate: 7 },
  { rotulo: '8 a 30 dias', ate: 30 },
  { rotulo: 'Mais de 30 dias', ate: Infinity },
];

function somarPorRotulo(linhas: LinhaDetalhamentoLead[], rotuloDe: (linha: LinhaDetalhamentoLead) => string): ItemDistribuicao[] {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    const rotulo = rotuloDe(linha);
    mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + linha.leads);
  }
  return Array.from(mapa.entries())
    .map(([rotulo, total]) => ({ rotulo, total }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

const soma = (itens: ItemDistribuicao[]) => itens.reduce((acumulado, item) => acumulado + item.total, 0);

/** Soma analytics_lead_breakdown_daily por dimensão — usado na aba Geral (Jornada do lead) e no PDF. */
/**
 * pageReferrer vem como URL completa. Tira protocolo/www e descarta quando é a própria
 * página de entrada ou do cadastro (recarga, ou passo repetido) — sobra só o passo do meio.
 */
function paginaAnterior(referrer: string | null, entrada: string, cadastro: string): string | null {
  if (!referrer) return null;
  const limpo = referrer.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '');
  const semHost = limpo.includes('/') ? limpo.slice(limpo.indexOf('/')) : '/';
  const semQuery = (pagina: string) => pagina.replace(/[?#].*$/, '');
  if (semHost === semQuery(entrada) || semHost === semQuery(cadastro)) return null;
  return limpo;
}

export function agruparJornadaDoLead(linhas: LinhaDetalhamentoLead[]): JornadaDoLead {
  if (linhas.length === 0) return JORNADA_VAZIA;

  const de = (kind: string) => linhas.filter((linha) => linha.kind === kind);

  const caminhosMapa = new Map<string, CaminhoLead>();
  for (const linha of de('caminho')) {
    const entrada = linha.dim1 ?? NAO_IDENTIFICADO;
    const cadastro = linha.dim2 ?? NAO_IDENTIFICADO;
    const anterior = paginaAnterior(linha.dim3 ?? null, entrada, cadastro);
    const chave = `${entrada}|${anterior}|${cadastro}`;
    const atual = caminhosMapa.get(chave) ?? { entrada, anterior, cadastro, leads: 0 };
    caminhosMapa.set(chave, { ...atual, leads: atual.leads + linha.leads });
  }
  const caminhos = Array.from(caminhosMapa.values())
    .filter((caminho) => caminho.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 8);

  const origens = somarPorRotulo(de('origem'), (linha) =>
    linha.dim1 || linha.dim2 ? `${linha.dim1 ?? NAO_IDENTIFICADO} / ${linha.dim2 ?? NAO_IDENTIFICADO}` : NAO_IDENTIFICADO
  );
  const idade = somarPorRotulo(de('idade'), (linha) => linha.dim1 ?? NAO_IDENTIFICADO);
  const genero = somarPorRotulo(de('genero'), (linha) => (linha.dim1 ? (ROTULO_GENERO[linha.dim1] ?? linha.dim1) : NAO_IDENTIFICADO));
  const local = somarPorRotulo(de('local'), (linha) => (linha.dim2 ? `${linha.dim2}${linha.dim1 ? ` / ${linha.dim1}` : ''}` : (linha.dim1 ?? NAO_IDENTIFICADO)));
  const retorno = somarPorRotulo(de('retorno'), (linha) => (linha.dim1 ? (ROTULO_RETORNO[linha.dim1] ?? linha.dim1) : NAO_IDENTIFICADO));

  const linhasTempo = de('tempo').filter((linha) => linha.dim1 !== null && linha.leads > 0);
  const totalTempo = linhasTempo.reduce((acumulado, linha) => acumulado + linha.leads, 0);
  const mediaDiasAteConverter =
    totalTempo > 0 ? linhasTempo.reduce((acumulado, linha) => acumulado + Number(linha.dim1) * linha.leads, 0) / totalTempo : null;
  const faixasTempo = FAIXAS_TEMPO.map((faixa, indice) => {
    const limiteInferior = indice === 0 ? -1 : FAIXAS_TEMPO[indice - 1].ate;
    return {
      rotulo: faixa.rotulo,
      total: linhasTempo
        .filter((linha) => Number(linha.dim1) > limiteInferior && Number(linha.dim1) <= faixa.ate)
        .reduce((acumulado, linha) => acumulado + linha.leads, 0),
    };
  }).filter((faixa) => faixa.total > 0);

  const totalRetorno = soma(retorno);
  const novos = retorno.find((item) => item.rotulo === 'Novos')?.total ?? 0;

  const totalLeads = Math.max(caminhos.reduce((acumulado, caminho) => acumulado + caminho.leads, 0), soma(origens), soma(idade), soma(genero), soma(local), totalRetorno, totalTempo);

  return {
    totalLeads,
    caminhos,
    origens: origens.slice(0, 8),
    idade,
    genero,
    local: local.slice(0, 8),
    retorno,
    mediaDiasAteConverter,
    faixasTempo,
    fracaoNovos: totalRetorno > 0 ? novos / totalRetorno : null,
    temDados: true,
  };
}
