import { useCallback, useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../services/dashboardService';
import type { PaginaLinha } from '../components/TopPagesTable';
import { PERIODOS_DASHBOARD, type AbaDashboard, type PeriodoDashboard } from '@/constants/dashboard.constants';
import {
  agruparAnalyticsPorDia,
  agruparSessoesPorPaginaEDispositivo,
  calcularPeriodoAnterior,
  compararComPeriodoAnterior,
  DISTRIBUICAO_VAZIA,
  JORNADA_VAZIA,
  somarTotaisAnalytics,
  type DistribuicaoDeLeads,
  type JornadaDoLead,
  type LinhaDispositivoAgregada,
} from '@/utils/metricsAggregation';
import { paraDataSaoPaulo } from '@/integrations/timezone';
import { calcularPainelDeMidia, calcularSerieCustoPorConversao, calcularSerieCustoPorLead, calcularSerieSessoesELeads, type LinhaMidiaBruta } from '@/utils/painelCalculos';
import type { CampaignCostEntry, LeadsDiario, Platform, Region } from '@/types/database.types';

interface PontoSerieAnalytics {
  date: string;
  sessions: number;
  users: number;
  leads: number;
}

interface MetricasAnalytics {
  sessions: number;
  users: number;
  leads: number;
  temDados: boolean;
}

interface LeadRecente {
  id: string;
  name: string | null;
  email: string | null;
  source: string | null;
  funnel_stage: string | null;
  region: Region | null;
  captured_at: string | null;
}

export interface IntervaloPersonalizado {
  inicio: Date;
  fim: Date;
}

/** Data de calendário (YYYY-MM-DD) de um Date escolhido no seletor — usa o dia local, nunca o UTC (que recuaria/avançaria um dia). */
function dataLocalParaIso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

/** Subtrai dias de uma data YYYY-MM-DD (aritmética de calendário, sem depender de fuso). */
function subtrairDias(data: string, dias: number): string {
  const resultado = new Date(`${data}T00:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() - dias);
  return resultado.toISOString().slice(0, 10);
}

function calcularIntervaloData(periodo: PeriodoDashboard, intervaloPersonalizado: IntervaloPersonalizado | null) {
  if (periodo === 'custom' && intervaloPersonalizado) {
    return { dataInicio: dataLocalParaIso(intervaloPersonalizado.inicio), dataFim: dataLocalParaIso(intervaloPersonalizado.fim) };
  }

  // "Hoje" é o dia em São Paulo — não o dia UTC, que já vira o seguinte a partir das 21h no horário de Brasília.
  const dias = PERIODOS_DASHBOARD.find((item) => item.valor === periodo)?.dias ?? 30;
  const hoje = paraDataSaoPaulo(new Date());
  return { dataInicio: subtrairDias(hoje, dias), dataFim: hoje };
}


export function useDashboardMetrics(
  aba: AbaDashboard,
  periodo: PeriodoDashboard,
  /** undefined = todas as contas ativas (mais as compartilhadas). Com ids = só essas contas somadas. Precisa ser estável (useMemo) — entra nas dependências da busca. */
  accountIds: string[] | undefined,
  /** Contas desativadas — excluídas da soma "todas" (ver dashboardService.ts). Irrelevante quando accountIds é informado (só contas ativas aparecem pra seleção). */
  idsContasInativas: string[] = [],
  intervaloPersonalizado: IntervaloPersonalizado | null = null,
  /**
   * false enquanto useAccounts() ainda não carregou (DashboardPage.tsx) —
   * sem isso, a 1ª busca deste hook roda com idsContasInativas ainda vazio
   * (porque a lista de contas nem chegou), mostra o valor incluindo a conta
   * desativada, e só se corrige depois que as contas carregam e o hook busca
   * de novo — dá exatamente a "piscada" de mostrar e sumir valor.
   */
  pronto = true
) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [linhasMidiaAtual, setLinhasMidiaAtual] = useState<LinhaMidiaBruta[]>([]);
  const [linhasMidiaAnterior, setLinhasMidiaAnterior] = useState<LinhaMidiaBruta[]>([]);
  const [metricasAnalyticsAtual, setMetricasAnalyticsAtual] = useState<MetricasAnalytics | null>(null);
  const [metricasAnalyticsAnterior, setMetricasAnalyticsAnterior] = useState<MetricasAnalytics | null>(null);
  const [serieTemporalAnalytics, setSerieTemporalAnalytics] = useState<PontoSerieAnalytics[]>([]);
  const [paginas, setPaginas] = useState<PaginaLinha[]>([]);
  const [jornadaDoLead, setJornadaDoLead] = useState<JornadaDoLead>(JORNADA_VAZIA);
  const [dispositivos, setDispositivos] = useState<LinhaDispositivoAgregada[]>([]);
  const [distribuicaoLeads, setDistribuicaoLeads] = useState<DistribuicaoDeLeads>(DISTRIBUICAO_VAZIA);
  const [linksFormularios, setLinksFormularios] = useState<Record<string, string>>({});
  const [distribuicaoLeadsAnterior, setDistribuicaoLeadsAnterior] = useState<DistribuicaoDeLeads>(DISTRIBUICAO_VAZIA);
  const [leadsRecentes, setLeadsRecentes] = useState<LeadRecente[]>([]);
  const [custoPorLead, setCustoPorLead] = useState<LeadsDiario[]>([]);
  const [custoPorLeadAnterior, setCustoPorLeadAnterior] = useState<LeadsDiario[]>([]);
  const [lancamentosCustoAtual, setLancamentosCustoAtual] = useState<CampaignCostEntry[]>([]);
  const [lancamentosCustoAnterior, setLancamentosCustoAnterior] = useState<CampaignCostEntry[]>([]);

  const { dataInicio, dataFim } = useMemo(
    () => calcularIntervaloData(periodo, intervaloPersonalizado),
    [periodo, intervaloPersonalizado]
  );
  const { dataInicio: dataInicioAnterior, dataFim: dataFimAnterior } = useMemo(
    () => calcularPeriodoAnterior(dataInicio, dataFim),
    [dataInicio, dataFim]
  );
  const platform: Platform | undefined = aba === 'google_ads' || aba === 'meta_ads' ? aba : undefined;

  const buscar = useCallback(async () => {
    if (!pronto) return; // espera useAccounts() carregar — ver comentário do parâmetro acima

    setCarregando(true);
    setErro(null);

    try {
      const filtrosMidia = { dataInicio, dataFim, platform, accountIds, idsContasInativas };
      const filtrosMidiaAnterior = { dataInicio: dataInicioAnterior, dataFim: dataFimAnterior, platform, accountIds, idsContasInativas };
      const filtrosAnalytics = { dataInicio, dataFim, accountIds, idsContasInativas };
      const filtrosAnalyticsAnterior = { dataInicio: dataInicioAnterior, dataFim: dataFimAnterior, accountIds, idsContasInativas };

      const buscaAnalytics = aba === 'geral';
      const buscaMidia = true;
      const buscaGeral = aba === 'geral';

      // Uma busca só, em paralelo: nenhuma dessas consultas depende do
      // resultado de outra, então rodar em blocos sequenciais (como era
      // antes) só somava a latência de rede de cada bloco em vez de pagar só
      // a mais lenta. linhasAnalytics também é reaproveitada localmente pra
      // totais/série/páginas/dispositivos, que antes refaziam essa mesma
      // consulta cada um por conta própria.
      const [
        linhasAnalytics,
        linhasAnalyticsAnteriores,
        jornada,
        linhasMidia,
        linhasMidiaAnteriores,
        lancamentos,
        lancamentosAnteriores,
        leads,
        distribuicao,
        distribuicaoAnterior,
        custo,
        custoAnterior,
        links,
      ] = await Promise.all([
        buscaAnalytics ? dashboardService.obterLinhasDeAnalytics(filtrosAnalytics) : Promise.resolve([]),
        buscaAnalytics ? dashboardService.obterLinhasDeAnalytics(filtrosAnalyticsAnterior) : Promise.resolve([]),
        buscaGeral ? dashboardService.obterJornadaDoLead(filtrosAnalytics) : Promise.resolve(JORNADA_VAZIA),
        buscaMidia ? dashboardService.obterLinhasDeMidia(filtrosMidia) : Promise.resolve([]),
        buscaMidia ? dashboardService.obterLinhasDeMidia(filtrosMidiaAnterior) : Promise.resolve([]),
        buscaMidia ? dashboardService.obterLancamentosDeCusto(filtrosMidia) : Promise.resolve([]),
        buscaMidia ? dashboardService.obterLancamentosDeCusto(filtrosMidiaAnterior) : Promise.resolve([]),
        buscaGeral ? dashboardService.obterLeadsRecentes(filtrosAnalytics) : Promise.resolve([]),
        buscaGeral ? dashboardService.obterDistribuicaoDeLeads(filtrosAnalytics) : Promise.resolve(DISTRIBUICAO_VAZIA),
        buscaGeral ? dashboardService.obterDistribuicaoDeLeads(filtrosAnalyticsAnterior) : Promise.resolve(DISTRIBUICAO_VAZIA),
        buscaGeral ? dashboardService.obterLeadsPorDia(filtrosAnalytics) : Promise.resolve([]),
        buscaGeral ? dashboardService.obterLeadsPorDia(filtrosAnalyticsAnterior) : Promise.resolve([]),
        buscaGeral ? dashboardService.obterLinksDeFormularios() : Promise.resolve({} as Record<string, string>),
      ]);

      if (buscaAnalytics) {
        setMetricasAnalyticsAtual(somarTotaisAnalytics(linhasAnalytics));
        setMetricasAnalyticsAnterior(somarTotaisAnalytics(linhasAnalyticsAnteriores));
        setSerieTemporalAnalytics(agruparAnalyticsPorDia(linhasAnalytics));
      } else {
        setMetricasAnalyticsAtual(null);
        setMetricasAnalyticsAnterior(null);
        setSerieTemporalAnalytics([]);
      }

      if (buscaGeral) {
        const detalhes = agruparSessoesPorPaginaEDispositivo(linhasAnalytics);
        setPaginas(detalhes.paginas);
        setDispositivos(detalhes.dispositivos);
        setJornadaDoLead(jornada);
      } else {
        setPaginas([]);
        setDispositivos([]);
        setJornadaDoLead(JORNADA_VAZIA);
      }

      if (buscaMidia) {
        setLinhasMidiaAtual(linhasMidia);
        setLinhasMidiaAnterior(linhasMidiaAnteriores);
        setLancamentosCustoAtual(lancamentos);
        setLancamentosCustoAnterior(lancamentosAnteriores);
      } else {
        setLinhasMidiaAtual([]);
        setLinhasMidiaAnterior([]);
        setLancamentosCustoAtual([]);
        setLancamentosCustoAnterior([]);
      }

      if (buscaGeral) {
        setLeadsRecentes(leads);
        setDistribuicaoLeads(distribuicao);
        setDistribuicaoLeadsAnterior(distribuicaoAnterior);
        setCustoPorLead(custo);
        setCustoPorLeadAnterior(custoAnterior);
        setLinksFormularios(links);
      } else {
        setLeadsRecentes([]);
        setDistribuicaoLeads(DISTRIBUICAO_VAZIA);
        setDistribuicaoLeadsAnterior(DISTRIBUICAO_VAZIA);
        setCustoPorLead([]);
        setCustoPorLeadAnterior([]);
        setLinksFormularios({});
      }
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar o dashboard');
    } finally {
      setCarregando(false);
    }
  }, [aba, dataInicio, dataFim, dataInicioAnterior, dataFimAnterior, platform, accountIds, idsContasInativas, pronto]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const painelMidia = useMemo(
    () =>
      calcularPainelDeMidia({
        linhasAtual: linhasMidiaAtual,
        linhasAnterior: linhasMidiaAnterior,
        lancamentosAtual: lancamentosCustoAtual,
        lancamentosAnterior: lancamentosCustoAnterior,
      }),
    [linhasMidiaAtual, linhasMidiaAnterior, lancamentosCustoAtual, lancamentosCustoAnterior]
  );
  const { metricasMidia, temDadosMidia, comparacaoMidia, detalhamentoCusto, comparacaoCustoDetalhado, comparativoPlataformas, campanhas } =
    painelMidia;

  const serieSessoesELeads = useMemo(
    () => calcularSerieSessoesELeads(serieTemporalAnalytics, custoPorLead, dataInicio, dataFim),
    [serieTemporalAnalytics, custoPorLead, dataInicio, dataFim]
  );

  const serieCustoPorConversao = useMemo(
    () => calcularSerieCustoPorConversao(linhasMidiaAtual, lancamentosCustoAtual, dataInicio, dataFim),
    [linhasMidiaAtual, lancamentosCustoAtual, dataInicio, dataFim]
  );

  const serieCustoPorLead = useMemo(
    () => calcularSerieCustoPorLead(custoPorLead, linhasMidiaAtual, lancamentosCustoAtual, dataInicio, dataFim),
    [custoPorLead, linhasMidiaAtual, lancamentosCustoAtual, dataInicio, dataFim]
  );

  const comparacaoAnalytics = useMemo(() => {
    if (!metricasAnalyticsAtual || !metricasAnalyticsAnterior) return null;
    return {
      sessions: compararComPeriodoAnterior(metricasAnalyticsAtual.sessions, metricasAnalyticsAnterior.sessions),
      users: compararComPeriodoAnterior(metricasAnalyticsAtual.users, metricasAnalyticsAnterior.users),
      leads: compararComPeriodoAnterior(metricasAnalyticsAtual.leads, metricasAnalyticsAnterior.leads),
    };
  }, [metricasAnalyticsAtual, metricasAnalyticsAnterior]);

  return {
    carregando,
    erro,
    metricasMidia,
    temDadosMidia,
    comparacaoMidia,
    detalhamentoCusto,
    comparacaoCustoDetalhado,
    metricasAnalytics: metricasAnalyticsAtual,
    metricasAnalyticsAnterior,
    comparacaoAnalytics,
    serieCustoPorConversao,
    serieSessoesELeads,
    serieCustoPorLead,
    campanhas,
    paginas,
    dispositivos,
    jornadaDoLead,
    distribuicaoLeads,
    distribuicaoLeadsAnterior,
    linksFormularios,
    comparativoPlataformas,
    leadsRecentes,
    custoPorLead,
    custoPorLeadAnterior,
    dataInicio,
    dataFim,
    recarregar: buscar,
  };
}
