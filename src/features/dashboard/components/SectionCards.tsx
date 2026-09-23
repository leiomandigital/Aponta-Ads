import { KpiCard } from '@/components/shared/KpiCard';
import type { AbaDashboard } from '@/constants/dashboard.constants';
import type { AggregatedMetrics, LeadCostDaily } from '@/types/database.types';
import { compararComPeriodoAnterior, type ComparacaoPeriodo } from '@/utils/metricsAggregation';
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

interface ComparacaoAnalytics {
  sessions: ComparacaoPeriodo;
  users: ComparacaoPeriodo;
  leads: ComparacaoPeriodo;
}

interface SectionCardsProps {
  aba: AbaDashboard;
  metricasMidia: AggregatedMetrics | null;
  temDadosMidia: boolean;
  comparacaoMidia?: ComparacaoMidia | null;
  metricasAnalytics: MetricasAnalytics | null;
  comparacaoAnalytics?: ComparacaoAnalytics | null;
  custoPorLead: LeadCostDaily[];
  custoPorLeadAnterior?: LeadCostDaily[];
  carregando: boolean;
}

function CardsDeMidiaPaga({
  metricas,
  temDados,
  comparacao,
  carregando,
}: {
  metricas: AggregatedMetrics | null;
  temDados: boolean;
  comparacao?: ComparacaoMidia | null;
  carregando: boolean;
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
      />
      <KpiCard
        titulo="Cliques"
        valor={v(formatarNumero(metricas?.clicks))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.clicks, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
      />
      <KpiCard
        titulo="Custo"
        valor={v(formatarMoeda(metricas?.cost))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.cost, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
      />
      <KpiCard
        titulo="Conversões"
        valor={v(formatarNumero(metricas?.conversions))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.conversions, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
      />
      <KpiCard
        titulo="CPM"
        valor={formatarMoeda(metricas?.cpm)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.cpm, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
      />
      <KpiCard
        titulo="CTR"
        valor={formatarPercentual(metricas?.ctr)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.ctr, formatarDelta: formatarPercentual, direcaoBoa: 'up' }}
      />
      <KpiCard
        titulo="CPC"
        valor={formatarMoeda(metricas?.cpc)}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.cpc, formatarDelta: formatarMoeda, direcaoBoa: 'down' }}
      />
    </div>
  );
}

function CardsDeAnalytics({
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        titulo="Sessões"
        valor={v(formatarNumero(metricas?.sessions))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.sessions, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
      />
      <KpiCard
        titulo="Usuários"
        valor={v(formatarNumero(metricas?.users))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.users, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
      />
      <KpiCard
        titulo="Leads"
        valor={v(formatarNumero(metricas?.leads))}
        carregando={carregando}
        comparacao={comparacao && { ...comparacao.leads, formatarDelta: formatarNumero, direcaoBoa: 'up' }}
      />
    </div>
  );
}

function somarCustoPorLead(linhas: LeadCostDaily[]) {
  const totalLeads = linhas.reduce((soma, linha) => soma + linha.leads_count, 0);
  const custoTotal = linhas.reduce((soma, linha) => soma + linha.total_cost, 0);
  const custoMedioPorLead = totalLeads > 0 ? custoTotal / totalLeads : null;
  return { totalLeads, custoTotal, custoMedioPorLead };
}

function CardsDeCustoPorLead({
  custoPorLead,
  custoPorLeadAnterior,
  carregando,
}: {
  custoPorLead: LeadCostDaily[];
  custoPorLeadAnterior?: LeadCostDaily[];
  carregando: boolean;
}) {
  const temDados = custoPorLead.length > 0;
  const v = (formatado: string) => (temDados ? formatado : SEM_DADOS);

  const atual = somarCustoPorLead(custoPorLead);
  const anterior = custoPorLeadAnterior ? somarCustoPorLead(custoPorLeadAnterior) : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        titulo="Leads no período"
        valor={v(formatarNumero(atual.totalLeads))}
        carregando={carregando}
        comparacao={
          anterior && {
            ...compararComPeriodoAnterior(atual.totalLeads, anterior.totalLeads),
            formatarDelta: formatarNumero,
            direcaoBoa: 'up',
          }
        }
      />
      <KpiCard
        titulo="Investimento associado"
        valor={v(formatarMoeda(atual.custoTotal))}
        carregando={carregando}
        comparacao={
          anterior && {
            ...compararComPeriodoAnterior(atual.custoTotal, anterior.custoTotal),
            formatarDelta: formatarMoeda,
            direcaoBoa: 'down',
          }
        }
      />
      <KpiCard
        titulo="Custo médio por lead"
        valor={formatarMoeda(atual.custoMedioPorLead)}
        carregando={carregando}
        comparacao={
          anterior && {
            ...compararComPeriodoAnterior(atual.custoMedioPorLead ?? 0, anterior.custoMedioPorLead ?? 0),
            formatarDelta: formatarMoeda,
            direcaoBoa: 'down',
          }
        }
      />
    </div>
  );
}

export function SectionCards({
  aba,
  metricasMidia,
  temDadosMidia,
  comparacaoMidia,
  metricasAnalytics,
  comparacaoAnalytics,
  custoPorLead,
  custoPorLeadAnterior,
  carregando,
}: SectionCardsProps) {
  if (aba === 'analytics') {
    return <CardsDeAnalytics metricas={metricasAnalytics} comparacao={comparacaoAnalytics} carregando={carregando} />;
  }

  if (aba === 'geral') {
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Mídia paga (Google Ads + Meta Ads)</h2>
          <CardsDeMidiaPaga metricas={metricasMidia} temDados={temDadosMidia} comparacao={comparacaoMidia} carregando={carregando} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Analytics</h2>
          <CardsDeAnalytics metricas={metricasAnalytics} comparacao={comparacaoAnalytics} carregando={carregando} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Custo por lead por origem</h2>
          <CardsDeCustoPorLead custoPorLead={custoPorLead} custoPorLeadAnterior={custoPorLeadAnterior} carregando={carregando} />
        </section>
      </div>
    );
  }

  return <CardsDeMidiaPaga metricas={metricasMidia} temDados={temDadosMidia} comparacao={comparacaoMidia} carregando={carregando} />;
}
