import { useCallback, useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../services/dashboardService';
import type { PaginaLinha } from '../components/TopPagesTable';
import type { CampanhaLinha } from '../components/CampaignsTable';
import type { ConjuntoLinha } from '../components/AdSetsTable';
import type { AnuncioLinha } from '../components/AdsTable';
import { PERIODOS_DASHBOARD, type AbaDashboard, type PeriodoDashboard } from '@/constants/dashboard.constants';
import {
  agruparCustoPorLeadPorDia,
  agruparMidiaPorChave,
  agruparMidiaPorDia,
  calcularMetricasAgregadas,
  compararComPeriodoAnterior,
} from '@/utils/metricsAggregation';
import type { AggregatedMetrics, LeadCostDaily, Platform, Region } from '@/types/database.types';

interface LinhaMidiaBruta {
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

interface PontoSerieMidia {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
}

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

/** Seleção em cascata das tabelas de mídia: campanha → conjunto de anúncio → anúncio. */
export interface SelecaoMidia {
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
}

const SELECAO_VAZIA: SelecaoMidia = { campaignId: null, adsetId: null, adId: null };

export interface IntervaloPersonalizado {
  inicio: Date;
  fim: Date;
}

function calcularIntervaloData(periodo: PeriodoDashboard, intervaloPersonalizado: IntervaloPersonalizado | null) {
  if (periodo === 'custom' && intervaloPersonalizado) {
    return {
      dataInicio: intervaloPersonalizado.inicio.toISOString().slice(0, 10),
      dataFim: intervaloPersonalizado.fim.toISOString().slice(0, 10),
    };
  }

  const dias = PERIODOS_DASHBOARD.find((item) => item.valor === periodo)?.dias ?? 30;
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias);
  return {
    dataInicio: inicio.toISOString().slice(0, 10),
    dataFim: fim.toISOString().slice(0, 10),
  };
}

/** Mesmo número de dias do período atual, imediatamente antes dele — usado na comparação dos cards. */
function calcularPeriodoAnterior(dataInicio: string, dataFim: string) {
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

const chaveCampanha = (linha: LinhaMidiaBruta) => `${linha.platform}:${linha.campaign_id}`;
const chaveConjunto = (linha: LinhaMidiaBruta) => `${linha.campaign_id}:${linha.adset_id}`;
const chaveAnuncio = (linha: LinhaMidiaBruta) => `${linha.campaign_id}:${linha.adset_id}:${linha.ad_id}`;

function filtrarPelaSelecao(linhas: LinhaMidiaBruta[], selecao: SelecaoMidia): LinhaMidiaBruta[] {
  return linhas.filter((linha) => {
    if (selecao.campaignId && chaveCampanha(linha) !== selecao.campaignId) return false;
    if (selecao.adsetId && chaveConjunto(linha) !== selecao.adsetId) return false;
    if (selecao.adId && chaveAnuncio(linha) !== selecao.adId) return false;
    return true;
  });
}

function comparacaoDeMetricas(atual: AggregatedMetrics, anterior: AggregatedMetrics) {
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

export function useDashboardMetrics(
  aba: AbaDashboard,
  periodo: PeriodoDashboard,
  /** undefined = "Geral", soma todas as contas ativas (mais as compartilhadas). */
  accountId: string | undefined,
  /** Contas desativadas — excluídas da soma "Geral" (ver dashboardService.ts). Irrelevante quando accountId é informado (só contas ativas aparecem pra seleção). */
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
  const [leadsRecentes, setLeadsRecentes] = useState<LeadRecente[]>([]);
  const [custoPorLead, setCustoPorLead] = useState<LeadCostDaily[]>([]);
  const [custoPorLeadAnterior, setCustoPorLeadAnterior] = useState<LeadCostDaily[]>([]);

  const [selecao, setSelecao] = useState<SelecaoMidia>(SELECAO_VAZIA);

  const { dataInicio, dataFim } = useMemo(
    () => calcularIntervaloData(periodo, intervaloPersonalizado),
    [periodo, intervaloPersonalizado]
  );
  const { dataInicio: dataInicioAnterior, dataFim: dataFimAnterior } = useMemo(
    () => calcularPeriodoAnterior(dataInicio, dataFim),
    [dataInicio, dataFim]
  );
  const platform: Platform | undefined = aba === 'google_ads' || aba === 'meta_ads' ? aba : undefined;

  // Trocar de aba muda o universo de campanhas (ou some com a tabela de mídia,
  // caso de Analytics/Geral) — uma seleção antiga não faz mais sentido.
  useEffect(() => {
    setSelecao(SELECAO_VAZIA);
  }, [aba]);

  const buscar = useCallback(async () => {
    if (!pronto) return; // espera useAccounts() carregar — ver comentário do parâmetro acima

    setCarregando(true);
    setErro(null);

    try {
      const filtrosMidia = { dataInicio, dataFim, platform, accountId, idsContasInativas };
      const filtrosMidiaAnterior = { dataInicio: dataInicioAnterior, dataFim: dataFimAnterior, platform, accountId, idsContasInativas };
      const filtrosAnalytics = { dataInicio, dataFim, accountId, idsContasInativas };
      const filtrosAnalyticsAnterior = { dataInicio: dataInicioAnterior, dataFim: dataFimAnterior, accountId, idsContasInativas };

      const buscaAnalytics = aba === 'analytics' || aba === 'geral';
      const buscaMidia = aba !== 'analytics';

      if (buscaAnalytics) {
        const [metricas, metricasAnteriores, serie] = await Promise.all([
          dashboardService.obterMetricasAnalytics(filtrosAnalytics),
          dashboardService.obterMetricasAnalytics(filtrosAnalyticsAnterior),
          dashboardService.obterSerieTemporalAnalytics(filtrosAnalytics),
        ]);
        setMetricasAnalyticsAtual(metricas);
        setMetricasAnalyticsAnterior(metricasAnteriores);
        setSerieTemporalAnalytics(serie);
      } else {
        setMetricasAnalyticsAtual(null);
        setMetricasAnalyticsAnterior(null);
        setSerieTemporalAnalytics([]);
      }

      if (aba === 'analytics') {
        setPaginas(await dashboardService.obterPrincipaisPaginas(filtrosAnalytics));
      } else {
        setPaginas([]);
      }

      if (buscaMidia) {
        const [linhas, linhasAnteriores] = await Promise.all([
          dashboardService.obterLinhasDeMidia(filtrosMidia),
          dashboardService.obterLinhasDeMidia(filtrosMidiaAnterior),
        ]);
        setLinhasMidiaAtual(linhas);
        setLinhasMidiaAnterior(linhasAnteriores);
      } else {
        setLinhasMidiaAtual([]);
        setLinhasMidiaAnterior([]);
      }

      if (aba === 'geral') {
        const [leads, custo, custoAnterior] = await Promise.all([
          dashboardService.obterLeadsRecentes({ dataInicio, dataFim, accountId, idsContasInativas }),
          dashboardService.obterCustoPorLeadPorOrigem({ dataInicio, dataFim, accountId, idsContasInativas }),
          dashboardService.obterCustoPorLeadPorOrigem({
            dataInicio: dataInicioAnterior,
            dataFim: dataFimAnterior,
            accountId,
            idsContasInativas,
          }),
        ]);
        setLeadsRecentes(leads);
        setCustoPorLead(custo);
        setCustoPorLeadAnterior(custoAnterior);
      } else {
        setLeadsRecentes([]);
        setCustoPorLead([]);
        setCustoPorLeadAnterior([]);
      }
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar o dashboard');
    } finally {
      setCarregando(false);
    }
  }, [aba, dataInicio, dataFim, dataInicioAnterior, dataFimAnterior, platform, accountId, idsContasInativas, pronto]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  // Cards, gráfico e comparação respeitam a seleção em cascata; as tabelas
  // de nível abaixo (conjunto/anúncio) também, e a seleção nunca precisa de
  // nova consulta ao banco — tudo deriva das mesmas linhas já carregadas.
  const linhasFiltradasAtual = useMemo(() => filtrarPelaSelecao(linhasMidiaAtual, selecao), [linhasMidiaAtual, selecao]);
  const linhasFiltradasAnterior = useMemo(() => filtrarPelaSelecao(linhasMidiaAnterior, selecao), [linhasMidiaAnterior, selecao]);

  const metricasMidia = useMemo(() => calcularMetricasAgregadas(linhasFiltradasAtual), [linhasFiltradasAtual]);
  const temDadosMidia = linhasFiltradasAtual.length > 0;
  const metricasMidiaAnterior = useMemo(() => calcularMetricasAgregadas(linhasFiltradasAnterior), [linhasFiltradasAnterior]);
  const comparacaoMidia = useMemo(
    () => comparacaoDeMetricas(metricasMidia, metricasMidiaAnterior),
    [metricasMidia, metricasMidiaAnterior]
  );

  const serieTemporalMidia = useMemo<PontoSerieMidia[]>(() => agruparMidiaPorDia(linhasFiltradasAtual), [linhasFiltradasAtual]);

  const serieCustoPorLead = useMemo(() => agruparCustoPorLeadPorDia(custoPorLead), [custoPorLead]);

  const comparacaoAnalytics = useMemo(() => {
    if (!metricasAnalyticsAtual || !metricasAnalyticsAnterior) return null;
    return {
      sessions: compararComPeriodoAnterior(metricasAnalyticsAtual.sessions, metricasAnalyticsAnterior.sessions),
      users: compararComPeriodoAnterior(metricasAnalyticsAtual.users, metricasAnalyticsAnterior.users),
      leads: compararComPeriodoAnterior(metricasAnalyticsAtual.leads, metricasAnalyticsAnterior.leads),
    };
  }, [metricasAnalyticsAtual, metricasAnalyticsAnterior]);

  const campanhas = useMemo<CampanhaLinha[]>(
    () =>
      agruparMidiaPorChave(linhasMidiaAtual, chaveCampanha, (linha) => ({
        campaign_id: linha.campaign_id,
        campaign_name: linha.campaign_name,
        platform: linha.platform,
      })).sort((a, b) => b.cost - a.cost) as unknown as CampanhaLinha[],
    [linhasMidiaAtual]
  );

  const conjuntos = useMemo<ConjuntoLinha[]>(() => {
    const base = linhasMidiaAtual.filter(
      (linha) => linha.adset_id && (!selecao.campaignId || chaveCampanha(linha) === selecao.campaignId)
    );
    return agruparMidiaPorChave(base, chaveConjunto, (linha) => ({
      campaign_id: linha.campaign_id,
      adset_id: linha.adset_id,
      adset_name: linha.adset_name,
    })).sort((a, b) => b.cost - a.cost) as unknown as ConjuntoLinha[];
  }, [linhasMidiaAtual, selecao.campaignId]);

  const anuncios = useMemo<AnuncioLinha[]>(() => {
    const base = linhasMidiaAtual.filter(
      (linha) =>
        linha.ad_id &&
        (!selecao.campaignId || chaveCampanha(linha) === selecao.campaignId) &&
        (!selecao.adsetId || chaveConjunto(linha) === selecao.adsetId)
    );
    return agruparMidiaPorChave(base, chaveAnuncio, (linha) => ({
      campaign_id: linha.campaign_id,
      adset_id: linha.adset_id,
      ad_id: linha.ad_id,
      ad_name: linha.ad_name,
    })).sort((a, b) => b.cost - a.cost) as unknown as AnuncioLinha[];
  }, [linhasMidiaAtual, selecao.campaignId, selecao.adsetId]);

  const selecionarCampanha = useCallback((campanha: CampanhaLinha) => {
    const id = chaveCampanha({ platform: campanha.platform, campaign_id: campanha.campaign_id } as LinhaMidiaBruta);
    setSelecao((atual) => (atual.campaignId === id ? SELECAO_VAZIA : { campaignId: id, adsetId: null, adId: null }));
  }, []);

  const selecionarConjunto = useCallback((conjunto: ConjuntoLinha) => {
    const id = chaveConjunto({ campaign_id: conjunto.campaign_id, adset_id: conjunto.adset_id } as LinhaMidiaBruta);
    setSelecao((atual) => (atual.adsetId === id ? { ...atual, adsetId: null, adId: null } : { ...atual, adsetId: id, adId: null }));
  }, []);

  const selecionarAnuncio = useCallback((anuncio: AnuncioLinha) => {
    const id = chaveAnuncio({ campaign_id: anuncio.campaign_id, adset_id: anuncio.adset_id, ad_id: anuncio.ad_id } as LinhaMidiaBruta);
    setSelecao((atual) => (atual.adId === id ? { ...atual, adId: null } : { ...atual, adId: id }));
  }, []);

  const limparSelecao = useCallback(() => setSelecao(SELECAO_VAZIA), []);

  return {
    carregando,
    erro,
    metricasMidia,
    metricasMidiaAnterior,
    temDadosMidia,
    comparacaoMidia,
    metricasAnalytics: metricasAnalyticsAtual,
    metricasAnalyticsAnterior,
    comparacaoAnalytics,
    serieTemporalMidia,
    serieTemporalAnalytics,
    serieCustoPorLead,
    campanhas,
    conjuntos,
    anuncios,
    selecao,
    selecionarCampanha,
    selecionarConjunto,
    selecionarAnuncio,
    limparSelecao,
    paginas,
    leadsRecentes,
    custoPorLead,
    custoPorLeadAnterior,
    dataInicio,
    dataFim,
    recarregar: buscar,
  };
}
