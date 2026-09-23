import type { AggregatedMetrics } from '../types/database.types.js';

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
