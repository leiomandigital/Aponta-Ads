// Cálculos do painel compartilhados entre o dashboard (useDashboardMetrics.ts) e o PDF
// (api/export/pdf.ts) — é isso que garante que o PDF mostre exatamente os mesmos números da tela.
// Imports relativos com .js: este arquivo também é alcançado pelo bundler da Vercel a partir de api/.
import type { AggregatedMetrics, CampaignCostEntry, CostBreakdown, LeadsDiario } from '../types/database.types.js';
import {
  agruparAnalyticsPorDia,
  agruparMidiaPorChave,
  agruparMidiaPorDia,
  agruparMidiaPorPlataforma,
  agruparSessoesPorPaginaEDispositivo,
  aplicarCustoTotalNasMetricas,
  calcularDetalhamentoDeCusto,
  calcularMetricasAgregadas,
  compararComPeriodoAnterior,
  compararMetricasAgregadas,
  somarTotaisAnalytics,
  type ComparacaoMetricasAgregadas,
  type ComparacaoPeriodo,
} from './metricsAggregation.js';

export interface LinhaMidiaBruta {
  date: string;
  platform: string;
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

export interface CampanhaLinha {
  campaign_id: string;
  campaign_name: string | null;
  platform: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
  /** Custo + taxa automática da plataforma (Meta). */
  costComTaxas: number;
  /** costComTaxas + custos adicionais (os da campanha + a parte do rateio dos sem campanha). */
  costTotal: number;
}

const chaveCampanha = (linha: Pick<LinhaMidiaBruta, 'platform' | 'campaign_id'>) => `${linha.platform}:${linha.campaign_id}`;

export interface PainelDeMidia {
  metricasMidia: AggregatedMetrics;
  temDadosMidia: boolean;
  comparacaoMidia: ComparacaoMetricasAgregadas;
  detalhamentoCusto: CostBreakdown;
  comparacaoCustoDetalhado: { costComTaxas: ComparacaoPeriodo; costTotal: ComparacaoPeriodo };
  serieTemporalMidia: ReturnType<typeof agruparMidiaPorDia>;
  comparativoPlataformas: Array<ReturnType<typeof agruparMidiaPorPlataforma>[number]>;
  campanhas: CampanhaLinha[];
}

/**
 * Tudo que o dashboard de mídia deriva das linhas de ad_performance_daily e dos lançamentos de custo:
 * CPM, CPC e custo/conversão sempre sobre o CUSTO TOTAL (mídia + taxas + avulsos).
 */
export function calcularPainelDeMidia({
  linhasAtual,
  linhasAnterior,
  lancamentosAtual,
  lancamentosAnterior,
}: {
  linhasAtual: LinhaMidiaBruta[];
  linhasAnterior: LinhaMidiaBruta[];
  lancamentosAtual: CampaignCostEntry[];
  lancamentosAnterior: CampaignCostEntry[];
}): PainelDeMidia {
  const detalhamentoCusto = calcularDetalhamentoDeCusto(linhasAtual, lancamentosAtual);
  const detalhamentoCustoAnterior = calcularDetalhamentoDeCusto(linhasAnterior, lancamentosAnterior);
  const comparacaoCustoDetalhado = {
    costComTaxas: compararComPeriodoAnterior(detalhamentoCusto.costComTaxas, detalhamentoCustoAnterior.costComTaxas),
    costTotal: compararComPeriodoAnterior(detalhamentoCusto.costTotal, detalhamentoCustoAnterior.costTotal),
  };

  const metricasMidia = aplicarCustoTotalNasMetricas(calcularMetricasAgregadas(linhasAtual), detalhamentoCusto.costTotal);
  const metricasMidiaAnterior = aplicarCustoTotalNasMetricas(calcularMetricasAgregadas(linhasAnterior), detalhamentoCustoAnterior.costTotal);
  const comparacaoMidia = compararMetricasAgregadas(metricasMidia, metricasMidiaAnterior);

  // Custo e custo/conversão do comparativo usam o custo total da plataforma (mídia + taxas + avulsos).
  const comparativoPlataformas = agruparMidiaPorPlataforma(linhasAtual).map((linha) => {
    const custoTotal = calcularDetalhamentoDeCusto(
      linhasAtual.filter((item) => item.platform === linha.platform),
      lancamentosAtual.filter((entrada) => entrada.platform === linha.platform)
    ).costTotal;
    return { ...aplicarCustoTotalNasMetricas(linha, custoTotal), cost: custoTotal };
  });

  const linhasDeCampanha = agruparMidiaPorChave(linhasAtual, chaveCampanha, (linha) => ({
    campaign_id: linha.campaign_id,
    campaign_name: linha.campaign_name,
    platform: linha.platform,
  })) as unknown as CampanhaLinha[];

  // Custo adicional sem campanha (campaign_id nulo) é dividido igualmente entre as campanhas da
  // plataforma no período e entra no "Custo total" de cada uma — assim a soma das campanhas fecha
  // com o card e CPM/CPC/custo por conversão ficam sobre o custo total.
  const campanhasPorPlataforma = new Map<string, number>();
  for (const linha of linhasDeCampanha) campanhasPorPlataforma.set(linha.platform, (campanhasPorPlataforma.get(linha.platform) ?? 0) + 1);
  const avulsoSemCampanhaPorPlataforma = new Map<string, number>();
  for (const entrada of lancamentosAtual) {
    if (entrada.campaign_id) continue;
    avulsoSemCampanhaPorPlataforma.set(entrada.platform, (avulsoSemCampanhaPorPlataforma.get(entrada.platform) ?? 0) + entrada.amount);
  }

  const campanhas = linhasDeCampanha
    .map((linha) => {
      const entradasDaCampanha = lancamentosAtual.filter(
        (entrada) => entrada.platform === linha.platform && entrada.campaign_id === linha.campaign_id
      );
      const detalhamento = calcularDetalhamentoDeCusto([{ platform: linha.platform, cost: linha.cost }], entradasDaCampanha);
      const parteDoAvulso = (avulsoSemCampanhaPorPlataforma.get(linha.platform) ?? 0) / (campanhasPorPlataforma.get(linha.platform) ?? 1);
      const costTotal = detalhamento.costTotal + parteDoAvulso;
      return { ...aplicarCustoTotalNasMetricas(linha, costTotal), costComTaxas: detalhamento.costComTaxas, costTotal };
    })
    .sort((a, b) => b.cost - a.cost);

  return {
    metricasMidia,
    temDadosMidia: linhasAtual.length > 0,
    comparacaoMidia,
    detalhamentoCusto,
    comparacaoCustoDetalhado,
    serieTemporalMidia: agruparMidiaPorDia(linhasAtual),
    comparativoPlataformas,
    campanhas,
  };
}

interface LinhaAnalyticsBruta {
  date: string;
  sessions: number;
  users: number;
  leads: number;
  page_path?: string | null;
  device: string | null;
}

/** Totais, comparação, série diária e sessões por dispositivo do GA4 — derivados das mesmas linhas. */
export function calcularPainelDeAnalytics(linhasAtual: LinhaAnalyticsBruta[], linhasAnterior: LinhaAnalyticsBruta[]) {
  const metricasAnalytics = somarTotaisAnalytics(linhasAtual);
  const metricasAnalyticsAnterior = somarTotaisAnalytics(linhasAnterior);
  return {
    metricasAnalytics,
    comparacaoAnalytics: {
      sessions: compararComPeriodoAnterior(metricasAnalytics.sessions, metricasAnalyticsAnterior.sessions),
      users: compararComPeriodoAnterior(metricasAnalytics.users, metricasAnalyticsAnterior.users),
      leads: compararComPeriodoAnterior(metricasAnalytics.leads, metricasAnalyticsAnterior.leads),
    },
    serieTemporalAnalytics: agruparAnalyticsPorDia(linhasAtual),
    dispositivos: agruparSessoesPorPaginaEDispositivo(linhasAtual).dispositivos,
  };
}

function diasDoPeriodo(dataInicio: string, dataFim: string): string[] {
  const dias: string[] = [];
  const fim = new Date(`${dataFim}T00:00:00Z`);
  for (let dia = new Date(`${dataInicio}T00:00:00Z`); dia <= fim; dia.setUTCDate(dia.getUTCDate() + 1)) dias.push(dia.toISOString().slice(0, 10));
  return dias;
}

export type PontoSessoesELeads = {
  date: string;
  /** Sessões do GA4 no dia; null quando o GA4 não tem dado nesse dia (diferente de zero sessões). */
  sessions: number | null;
  /** Leads do RD Station no dia (0 nos dias sem lead). */
  leads: number;
};

/**
 * Gráfico "Sessões e leads" do Geral: sessões vêm do GA4 e os leads vêm do RD Station (mesma base do card
 * "Leads" e do gráfico "Custo por lead"). Todos os dias do período entram.
 */
export function calcularSerieSessoesELeads(
  serieAnalytics: Array<{ date: string; sessions: number }>,
  custoPorLead: LeadsDiario[],
  dataInicio: string,
  dataFim: string
): PontoSessoesELeads[] {
  const sessoesPorDia = new Map(serieAnalytics.map((ponto) => [ponto.date, ponto.sessions]));
  const leadsPorDia = new Map<string, number>();
  for (const linha of custoPorLead) leadsPorDia.set(linha.date, (leadsPorDia.get(linha.date) ?? 0) + linha.leads_count);

  return diasDoPeriodo(dataInicio, dataFim).map((date) => ({
    date,
    sessions: sessoesPorDia.get(date) ?? null,
    leads: leadsPorDia.get(date) ?? 0,
  }));
}

export type PontoCustoPorConversao = {
  date: string;
  /** Custo total do dia ÷ conversões do dia; null nos dias sem conversão. */
  cost_per_conversion: number | null;
  /** Conversões do dia (da própria plataforma: Google Ads ou Meta Ads). */
  conversions: number;
};

/**
 * Gráfico "Custo por conversão" dos dashboards Google Ads e Meta Ads: custo total do dia (mídia + taxas + avulsos)
 * ÷ conversões do dia, mais as conversões por dia. Todos os dias do período entram.
 */
export function calcularSerieCustoPorConversao(
  linhasMidia: LinhaMidiaBruta[],
  lancamentos: CampaignCostEntry[],
  dataInicio: string,
  dataFim: string
): PontoCustoPorConversao[] {
  const midiaPorDia = new Map<string, LinhaMidiaBruta[]>();
  for (const linha of linhasMidia) midiaPorDia.set(linha.date, [...(midiaPorDia.get(linha.date) ?? []), linha]);
  const avulsosPorDia = new Map<string, CampaignCostEntry[]>();
  for (const entrada of lancamentos) avulsosPorDia.set(entrada.date, [...(avulsosPorDia.get(entrada.date) ?? []), entrada]);

  return diasDoPeriodo(dataInicio, dataFim).map((date) => {
    const linhasDoDia = midiaPorDia.get(date) ?? [];
    const conversions = linhasDoDia.reduce((soma, linha) => soma + linha.conversions, 0);
    const custoTotal = calcularDetalhamentoDeCusto(linhasDoDia, avulsosPorDia.get(date) ?? []).costTotal;
    return { date, cost_per_conversion: conversions > 0 ? custoTotal / conversions : null, conversions };
  });
}

export type PontoCustoPorLead = {
  date: string;
  /** Custo total do dia ÷ leads do dia; null nos dias sem lead (não existe custo por lead). */
  cost_per_lead: number | null;
  /** Leads do RD Station no dia (0 nos dias sem lead). */
  leads: number;
};

/**
 * Custo por lead do dia = custo total do dia (mídia + taxas + avulsos, o mesmo do card "Custo total")
 * ÷ leads do RD Station no dia. Todos os dias do período entram: sem lead, o custo por lead é null e os leads são 0.
 */
export function calcularSerieCustoPorLead(
  custoPorLead: LeadsDiario[],
  linhasMidia: LinhaMidiaBruta[],
  lancamentos: CampaignCostEntry[],
  dataInicio: string,
  dataFim: string
): PontoCustoPorLead[] {
  const leadsPorDia = new Map<string, number>();
  for (const linha of custoPorLead) leadsPorDia.set(linha.date, (leadsPorDia.get(linha.date) ?? 0) + linha.leads_count);

  const midiaPorDia = new Map<string, LinhaMidiaBruta[]>();
  for (const linha of linhasMidia) midiaPorDia.set(linha.date, [...(midiaPorDia.get(linha.date) ?? []), linha]);
  const avulsosPorDia = new Map<string, CampaignCostEntry[]>();
  for (const entrada of lancamentos) avulsosPorDia.set(entrada.date, [...(avulsosPorDia.get(entrada.date) ?? []), entrada]);

  return diasDoPeriodo(dataInicio, dataFim).map((date) => {
    const leads = leadsPorDia.get(date) ?? 0;
    return {
      date,
      cost_per_lead: leads > 0 ? calcularDetalhamentoDeCusto(midiaPorDia.get(date) ?? [], avulsosPorDia.get(date) ?? []).costTotal / leads : null,
      leads,
    };
  });
}

const somarLeads = (linhas: LeadsDiario[]) => linhas.reduce((soma, linha) => soma + linha.leads_count, 0);

/** Card "Leads" (RD Station) e card "CPL" (custo total ÷ leads), com a comparação do período anterior. */
export function calcularLeadsECpl({
  custoPorLead,
  custoPorLeadAnterior,
  detalhamentoCusto,
  comparacaoCustoDetalhado,
}: {
  custoPorLead: LeadsDiario[];
  custoPorLeadAnterior?: LeadsDiario[];
  detalhamentoCusto?: CostBreakdown | null;
  comparacaoCustoDetalhado?: { costTotal: ComparacaoPeriodo } | null;
}) {
  const leads = somarLeads(custoPorLead);
  const leadsAnterior = custoPorLeadAnterior ? somarLeads(custoPorLeadAnterior) : null;
  const custoTotal = detalhamentoCusto?.costTotal ?? 0;
  const cpl = leads > 0 ? custoTotal / leads : null;
  const custoTotalAnterior = comparacaoCustoDetalhado ? custoTotal - comparacaoCustoDetalhado.costTotal.delta : null;
  const cplAnterior = leadsAnterior && leadsAnterior > 0 && custoTotalAnterior !== null ? custoTotalAnterior / leadsAnterior : null;

  return {
    temLeads: custoPorLead.length > 0,
    leads,
    comparacaoLeads: leadsAnterior !== null ? compararComPeriodoAnterior(leads, leadsAnterior) : null,
    cpl,
    comparacaoCpl: cpl !== null && cplAnterior !== null ? compararComPeriodoAnterior(cpl, cplAnterior) : null,
  };
}

/** Card "Custo/conversão" dos dashboards Google Ads e Meta Ads: custo total ÷ conversões. */
export function calcularCustoPorConversao({
  conversoes,
  detalhamentoCusto,
  comparacaoConversoes,
  comparacaoCustoDetalhado,
}: {
  conversoes: number;
  detalhamentoCusto?: CostBreakdown | null;
  comparacaoConversoes?: ComparacaoPeriodo | null;
  comparacaoCustoDetalhado?: { costTotal: ComparacaoPeriodo } | null;
}) {
  const custoTotal = detalhamentoCusto?.costTotal ?? 0;
  const cpa = conversoes > 0 ? custoTotal / conversoes : null;
  const conversoesAnterior = comparacaoConversoes ? conversoes - comparacaoConversoes.delta : null;
  const custoTotalAnterior = comparacaoCustoDetalhado ? custoTotal - comparacaoCustoDetalhado.costTotal.delta : null;
  const cpaAnterior = conversoesAnterior && conversoesAnterior > 0 && custoTotalAnterior !== null ? custoTotalAnterior / conversoesAnterior : null;

  return { cpa, comparacao: cpa !== null && cpaAnterior !== null ? compararComPeriodoAnterior(cpa, cpaAnterior) : null };
}
