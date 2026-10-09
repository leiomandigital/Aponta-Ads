import { KpiCard } from '@/components/shared/KpiCard';
import type { AbaDashboard } from '@/constants/dashboard.constants';
import type { AggregatedMetrics, CostBreakdown, IntegrationKey, LeadsDiario } from '@/types/database.types';
import type { ComparacaoPeriodo } from '@/utils/metricsAggregation';
import { calcularCustoPorConversao, calcularLeadsECpl } from '@/utils/painelCalculos';
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/utils/formatters';

const SEM_DADOS = '—';

interface MetricasAnalytics {
  sessions: number;
  users: number;
  leads: number;
  temDados: boolean;
}

interface ComparacaoMidia {
  impressions: ComparacaoPeriodo;
  clicks: ComparacaoPeriodo;
  cost: ComparacaoPeriodo;
  conversions: ComparacaoPeriodo;
  cpm: ComparacaoPeriodo;
  ctr: ComparacaoPeriodo;
  cpc: ComparacaoPeriodo;
}

interface ComparacaoCustoDetalhado {
  costComTaxas: ComparacaoPeriodo;
  costTotal: ComparacaoPeriodo;
}

interface ComparacaoAnalytics {
  sessions: ComparacaoPeriodo;
  users: ComparacaoPeriodo;
  leads: ComparacaoPeriodo;
}

interface SectionCardsProps {
  aba: Exclude<AbaDashboard, 'geral'>;
  metricasMidia: AggregatedMetrics | null;
  temDadosMidia: boolean;
  comparacaoMidia?: ComparacaoMidia | null;
  detalhamentoCusto?: CostBreakdown | null;
  comparacaoCustoDetalhado?: ComparacaoCustoDetalhado | null;
  carregando: boolean;
}

export function CardsDeMidiaPaga({
  metricas,
  temDados,
  comparacao,
  detalhamentoCusto,
  comparacaoCustoDetalhado,
  carregando,
  plataformas,
}: {
  metricas: AggregatedMetrics | null;
  temDados: boolean;
  comparacao?: ComparacaoMidia | null;
  detalhamentoCusto?: CostBreakdown | null;
  comparacaoCustoDetalhado?: ComparacaoCustoDetalhado | null;
  carregando: boolean;
  plataformas: IntegrationKey[];
}) {
  // Zero é um valor real (a campanha rodou e teve 0 cliques, por exemplo);
  // "—" é para quando não existe nenhuma linha para medir nesse período/seleção.
  const v = (formatado: string) => (temDados ? formatado : SEM_DADOS);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        titulo="Impressões"
        valor={v(formatarNumero(metricas?.impressions))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.impressions, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
        plataformas={plataformas}
      />
      <KpiCard
        titulo="Cliques"
        valor={v(formatarNumero(metricas?.clicks))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.clicks, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
        plataformas={plataformas}
      />
      <KpiCard
        titulo="Custo de mídia"
        valor={v(formatarMoeda(metricas?.cost))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.cost, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
        plataformas={plataformas}
      />
      <KpiCard
        titulo="Custo com taxas"
        valor={v(formatarMoeda(detalhamentoCusto?.costComTaxas))}
        carregando={carregando}
        comparacao={
          comparacaoCustoDetalhado && { ...comparacaoCustoDetalhado.costComTaxas, formatarDelta: formatarMoeda, direcaoBoa: 'down' }
        }
        plataformas={plataformas}
      />
      <KpiCard
        titulo="Custo total"
        valor={v(formatarMoeda(detalhamentoCusto?.costTotal))}
        carregando={carregando}
        comparacao={comparacaoCustoDetalhado && { ...comparacaoCustoDetalhado.costTotal, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
        plataformas={plataformas}
      />
      <KpiCard
        titulo="Conversões"
        valor={v(formatarNumero(metricas?.conversions))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.conversions, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
        plataformas={plataformas}
      />
      <KpiCard
        titulo="CPM"
        valor={formatarMoeda(metricas?.cpm)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.cpm, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
        plataformas={plataformas}
      />
      <KpiCard
        titulo="CTR"
        valor={formatarPercentual(metricas?.ctr)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.ctr, formatarDelta: formatarPercentual, direcaoBoa: 'up' }}
        plataformas={plataformas}
      />
      <KpiCard
        titulo="CPC"
        valor={formatarMoeda(metricas?.cpc)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.cpc, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
        plataformas={plataformas}
      />
    </div>
  );
}

export function CardsDeAnalytics({
  metricas,
  comparacao,
  carregando,
}: {
  metricas: MetricasAnalytics | null;
  comparacao?: ComparacaoAnalytics | null;
  carregando: boolean;
}) {
  const v = (formatado: string) => (metricas?.temDados ? formatado : SEM_DADOS);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        titulo="Sessões"
        valor={v(formatarNumero(metricas?.sessions))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.sessions, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
        plataformas={['ga4']}
      />
      <KpiCard
        titulo="Usuários"
        valor={v(formatarNumero(metricas?.users))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.users, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
        plataformas={['ga4']}
      />
    </div>
  );
}

export function CardsGeral({
  metricas,
  temDados,
  comparacao,
  detalhamentoCusto,
  comparacaoCustoDetalhado,
  custoPorLead,
  custoPorLeadAnterior,
  carregando,
}: {
  metricas: AggregatedMetrics | null;
  temDados: boolean;
  comparacao?: ComparacaoMidia | null;
  detalhamentoCusto?: CostBreakdown | null;
  comparacaoCustoDetalhado?: ComparacaoCustoDetalhado | null;
  custoPorLead: LeadsDiario[];
  custoPorLeadAnterior?: LeadsDiario[];
  carregando: boolean;
}) {
  const midia: IntegrationKey[] = ['google_ads', 'meta_ads'];
  const v = (formatado: string) => (temDados ? formatado : SEM_DADOS);

  const { temLeads, leads, comparacaoLeads, cpl, comparacaoCpl } = calcularLeadsECpl({
    custoPorLead,
    custoPorLeadAnterior,
    detalhamentoCusto,
    comparacaoCustoDetalhado,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        titulo="Impressões"
        valor={v(formatarNumero(metricas?.impressions))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.impressions, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
        plataformas={midia}
      />
      <KpiCard
        titulo="Cliques"
        valor={v(formatarNumero(metricas?.clicks))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.clicks, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
        plataformas={midia}
      />
      <KpiCard
        titulo="Leads"
        valor={temLeads ? formatarNumero(leads) : SEM_DADOS}
        carregando={carregando}
        comparacao={comparacaoLeads ? { ...comparacaoLeads, formatarDelta: formatarNumero, direcaoBoa: 'up' } : undefined}
        plataformas={['rd_station']}
      />
      <KpiCard
        titulo="Custo total"
        valor={v(formatarMoeda(detalhamentoCusto?.costTotal))}
        carregando={carregando}
        comparacao={comparacaoCustoDetalhado && { ...comparacaoCustoDetalhado.costTotal, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
        plataformas={midia}
      />
      <KpiCard
        titulo="CPM"
        valor={formatarMoeda(metricas?.cpm)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.cpm, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
        plataformas={midia}
      />
      <KpiCard
        titulo="CPC"
        valor={formatarMoeda(metricas?.cpc)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.cpc, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
        plataformas={midia}
      />
      <KpiCard
        titulo="CPL"
        valor={cpl !== null ? formatarMoeda(cpl) : SEM_DADOS}
        carregando={carregando}
        comparacao={comparacaoCpl ? { ...comparacaoCpl, formatarDelta: formatarMoeda, direcaoBoa: 'down' } : undefined}
        plataformas={['rd_station']}
      />
      <KpiCard
        titulo="CTR"
        valor={formatarPercentual(metricas?.ctr)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.ctr, formatarDelta: formatarPercentual, direcaoBoa: 'up' }}
        plataformas={midia}
      />
    </div>
  );
}

/**
 * Cards dos dashboards Google Ads e Meta Ads: custo/conversão usa o custo total (mídia + taxas +
 * avulsos) ÷ conversões. Meta mostra também "Custo com taxas" (Google não tem taxa automática).
 */
function CardsPlataforma({
  plataforma,
  metricas,
  temDados,
  comparacao,
  detalhamentoCusto,
  comparacaoCustoDetalhado,
  carregando,
}: {
  plataforma: 'google_ads' | 'meta_ads';
  metricas: AggregatedMetrics | null;
  temDados: boolean;
  comparacao?: ComparacaoMidia | null;
  detalhamentoCusto?: CostBreakdown | null;
  comparacaoCustoDetalhado?: ComparacaoCustoDetalhado | null;
  carregando: boolean;
}) {
  const plataformas: IntegrationKey[] = [plataforma];
  const comTaxas = plataforma === 'meta_ads';
  const v = (formatado: string) => (temDados ? formatado : SEM_DADOS);

  const { cpa, comparacao: comparacaoCpa } = calcularCustoPorConversao({
    conversoes: metricas?.conversions ?? 0,
    detalhamentoCusto,
    comparacaoConversoes: comparacao?.conversions,
    comparacaoCustoDetalhado,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          titulo="Impressões"
          valor={v(formatarNumero(metricas?.impressions))}
          carregando={carregando}
          comparacao={comparacao && { ...comparacao.impressions, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
          plataformas={plataformas}
        />
        <KpiCard
          titulo="Cliques"
          valor={v(formatarNumero(metricas?.clicks))}
          carregando={carregando}
          comparacao={comparacao && { ...comparacao.clicks, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
          plataformas={plataformas}
        />
        <KpiCard
          titulo="Conversões"
          valor={v(formatarNumero(metricas?.conversions))}
          carregando={carregando}
          comparacao={comparacao && { ...comparacao.conversions, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
          plataformas={plataformas}
        />
      </div>
      <div className={comTaxas ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
        <KpiCard
          titulo="Custo/conversão"
          valor={cpa !== null ? formatarMoeda(cpa) : SEM_DADOS}
          carregando={carregando}
          comparacao={comparacaoCpa ? { ...comparacaoCpa, formatarDelta: formatarMoeda, direcaoBoa: 'down' } : undefined}
          plataformas={plataformas}
        />
        <KpiCard
          titulo="Custo de mídia"
          valor={v(formatarMoeda(metricas?.cost))}
          carregando={carregando}
          comparacao={comparacao && { ...comparacao.cost, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
          plataformas={plataformas}
        />
        {comTaxas && (
          <KpiCard
            titulo="Custo com taxas"
            valor={v(formatarMoeda(detalhamentoCusto?.costComTaxas))}
            carregando={carregando}
            comparacao={
              comparacaoCustoDetalhado && { ...comparacaoCustoDetalhado.costComTaxas, formatarDelta: formatarMoeda, direcaoBoa: 'down' }
            }
            plataformas={plataformas}
          />
        )}
        <KpiCard
          titulo="Custo total"
          valor={v(formatarMoeda(detalhamentoCusto?.costTotal))}
          carregando={carregando}
          comparacao={comparacaoCustoDetalhado && { ...comparacaoCustoDetalhado.costTotal, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
          plataformas={plataformas}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          titulo="CPM"
          valor={formatarMoeda(metricas?.cpm)}
          carregando={carregando}
          comparacao={comparacao && { ...comparacao.cpm, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
          plataformas={plataformas}
        />
        <KpiCard
          titulo="CPC"
          valor={formatarMoeda(metricas?.cpc)}
          carregando={carregando}
          comparacao={comparacao && { ...comparacao.cpc, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
          plataformas={plataformas}
        />
        <KpiCard
          titulo="CTR"
          valor={formatarPercentual(metricas?.ctr)}
          carregando={carregando}
          comparacao={comparacao && { ...comparacao.ctr, formatarDelta: formatarPercentual, direcaoBoa: 'up' }}
          plataformas={plataformas}
        />
      </div>
    </div>
  );
}

export function SectionCards({
  aba,
  metricasMidia,
  temDadosMidia,
  comparacaoMidia,
  detalhamentoCusto,
  comparacaoCustoDetalhado,
  carregando,
}: SectionCardsProps) {
  return (
    <CardsPlataforma
      plataforma={aba}
      metricas={metricasMidia}
      temDados={temDadosMidia}
      comparacao={comparacaoMidia}
      detalhamentoCusto={detalhamentoCusto}
      comparacaoCustoDetalhado={comparacaoCustoDetalhado}
      carregando={carregando}
    />
  );
}
