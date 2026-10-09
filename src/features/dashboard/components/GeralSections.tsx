import { Fragment, useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { KpiCard } from '@/components/shared/KpiCard';
import { PlatformIcon } from '@/components/shared/icons/PlatformIcon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AggregatedMetrics, IntegrationKey } from '@/types/database.types';
import { compararDistribuicoes, sequenciaDoCaminho, type ComparacaoPeriodo, type ItemDistribuicao, type JornadaDoLead, type LinhaDispositivoAgregada } from '@/utils/metricsAggregation';
import { extrairPathDaUrl, formatarMoeda, formatarNumero, formatarPercentual } from '@/utils/formatters';

const SEM_DADOS = '—';

/** Título de seção com o(s) ícone(s) da plataforma de origem dos dados, igual aos KpiCards. */
export function TituloSecao({ titulo, plataformas }: { titulo: string; plataformas: IntegrationKey[] }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{titulo}</h2>
      {plataformas.map((plataforma) => (
        <PlatformIcon key={plataforma} plataforma={plataforma} className="h-3.5 w-3.5" />
      ))}
    </div>
  );
}

const ROTULO_PLATAFORMA: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads' };

/**
 * Comparação com o período anterior, no mesmo estilo de cor/ícone do
 * KpiCard — só compacta o bastante pra caber numa linha de distribuição.
 * `detalhado` (usado no caso de categoria única, que tem mais espaço) inclui
 * o delta e o texto "vs. período anterior"; sem isso, só ícone + percentual.
 */
function ComparacaoDistribuicao({ comparacao, detalhado }: { comparacao: ComparacaoPeriodo; detalhado?: boolean }) {
  const semVariacao = comparacao.delta === 0 && comparacao.percentual === null;
  if (semVariacao) return null;

  const subiu = comparacao.delta > 0;
  const Icone = subiu ? TrendingUp : TrendingDown;
  const percentualTexto = comparacao.percentual !== null ? formatarPercentual(Math.abs(comparacao.percentual)) : 'novo';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap',
        detalhado ? 'text-xs' : 'text-[11px]',
        subiu ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
      )}
    >
      <Icone className="h-3 w-3" />
      {percentualTexto}
      {detalhado && (
        <span className="font-normal text-muted-foreground">
          {' '}
          ({comparacao.delta >= 0 ? '+' : ''}
          {formatarNumero(comparacao.delta)} vs. período anterior)
        </span>
      )}
    </span>
  );
}

export function DistribuicaoCard({
  titulo,
  itens,
  itensAnteriores,
  carregando,
  plataformas,
}: {
  titulo: string;
  itens: ItemDistribuicao[];
  /** Período anterior, mesmo rótulo — presente = mostra comparação por linha, igual aos KpiCards. Ausente = não compara (ex: dados vindos da jornada do lead, que ainda não busca o período anterior). */
  itensAnteriores?: ItemDistribuicao[];
  carregando: boolean;
  plataformas: IntegrationKey[];
}) {
  const total = itens.reduce((soma, item) => soma + item.total, 0);
  const maior = Math.max(...itens.map((item) => item.total), 1);
  const comComparacao = itensAnteriores ? compararDistribuicoes(itens, itensAnteriores) : null;
  const comparacaoPorRotulo = useMemo(
    () => new Map((comComparacao ?? []).map((item) => [item.rotulo, item.comparacao])),
    [comComparacao]
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
        <div className="flex shrink-0 items-center gap-1">
          {plataformas.map((plataforma) => (
            <PlatformIcon key={plataforma} plataforma={plataforma} className="h-3.5 w-3.5" />
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {carregando ? (
          Array.from({ length: 4 }).map((_, indice) => <Skeleton key={indice} className="h-5 w-full" />)
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">sem dados neste período</p>
        ) : itens.length === 1 ? (
          // Uma categoria só: a barra sempre fecharia em 100% e não compara
          // nada — mostra a contagem direto em vez de um "100%" sem sentido.
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{formatarNumero(itens[0].total)}</span>
              {itens[0].rotulo && (
                <span className="truncate text-sm text-muted-foreground" title={itens[0].rotulo}>
                  {itens[0].rotulo}
                </span>
              )}
            </div>
            {comparacaoPorRotulo.get(itens[0].rotulo) && (
              <ComparacaoDistribuicao comparacao={comparacaoPorRotulo.get(itens[0].rotulo)!} detalhado />
            )}
          </div>
        ) : (
          itens.slice(0, 8).map((item) => (
            <div key={item.rotulo} className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-2 text-xs">
              <span className="truncate text-muted-foreground" title={item.rotulo}>
                {item.rotulo}
              </span>
              <div className="h-2 rounded bg-muted">
                <div className="h-2 rounded" style={{ width: `${(item.total / maior) * 100}%`, background: 'var(--series-1)' }} />
              </div>
              <span className="flex items-center gap-1.5 tabular-nums">
                {formatarNumero(item.total)}{' '}
                <span className="text-muted-foreground">({formatarPercentual(total > 0 ? item.total / total : 0)})</span>
                {comparacaoPorRotulo.get(item.rotulo) && <ComparacaoDistribuicao comparacao={comparacaoPorRotulo.get(item.rotulo)!} />}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

type LinhaPlataforma = AggregatedMetrics & { platform: string };

export function ComparativoPlataformasTable({
  linhas,
  carregando,
  mensagemVazio,
}: {
  linhas: LinhaPlataforma[];
  carregando: boolean;
  mensagemVazio: string;
}) {
  const colunas = useMemo<ColumnDef<LinhaPlataforma, unknown>[]>(
    () => [
      {
        accessorKey: 'platform',
        header: 'Plataforma',
        cell: ({ row }) => ROTULO_PLATAFORMA[row.original.platform] ?? row.original.platform,
      },
      { accessorKey: 'cost', header: 'Custo', cell: ({ row }) => formatarMoeda(row.original.cost) },
      { accessorKey: 'impressions', header: 'Impressões', cell: ({ row }) => formatarNumero(row.original.impressions) },
      { accessorKey: 'clicks', header: 'Cliques', cell: ({ row }) => formatarNumero(row.original.clicks) },
      { accessorKey: 'conversions', header: 'Conversões', cell: ({ row }) => formatarNumero(row.original.conversions) },
      { accessorKey: 'cpm', header: 'CPM', cell: ({ row }) => formatarMoeda(row.original.cpm) },
      { accessorKey: 'cpc', header: 'CPC', cell: ({ row }) => formatarMoeda(row.original.cpc) },
      { accessorKey: 'ctr', header: 'CTR', cell: ({ row }) => formatarPercentual(row.original.ctr) },
      { accessorKey: 'cpa', header: 'Custo/conversão', cell: ({ row }) => formatarMoeda(row.original.cpa) },
    ],
    []
  );
  return <DataTable columns={colunas} data={linhas} carregando={carregando} mensagemVazio={mensagemVazio} />;
}

interface LinhaCustoOrigem {
  source: string;
  leads_count: number;
  total_cost: number;
  cost_per_lead: number | null;
}

export function CustoPorOrigemTable({
  linhas,
  carregando,
  mensagemVazio,
}: {
  linhas: LinhaCustoOrigem[];
  carregando: boolean;
  mensagemVazio: string;
}) {
  const colunas = useMemo<ColumnDef<LinhaCustoOrigem, unknown>[]>(
    () => [
      { accessorKey: 'source', header: 'Origem' },
      { accessorKey: 'leads_count', header: 'Leads', cell: ({ row }) => formatarNumero(row.original.leads_count) },
      { accessorKey: 'total_cost', header: 'Investimento', cell: ({ row }) => formatarMoeda(row.original.total_cost) },
      { accessorKey: 'cost_per_lead', header: 'Custo/lead', cell: ({ row }) => formatarMoeda(row.original.cost_per_lead) },
    ],
    []
  );
  return <DataTable columns={colunas} data={linhas} carregando={carregando} mensagemVazio={mensagemVazio} />;
}

export function DispositivosTable({
  linhas,
  carregando,
  mensagemVazio,
}: {
  linhas: LinhaDispositivoAgregada[];
  carregando: boolean;
  mensagemVazio: string;
}) {
  const colunas = useMemo<ColumnDef<LinhaDispositivoAgregada, unknown>[]>(
    () => [
      { accessorKey: 'device', header: 'Dispositivo' },
      { accessorKey: 'sessions', header: 'Sessões', cell: ({ row }) => formatarNumero(row.original.sessions) },
      { accessorKey: 'users', header: 'Usuários', cell: ({ row }) => formatarNumero(row.original.users) },
      { accessorKey: 'leads', header: 'Leads', cell: ({ row }) => formatarNumero(row.original.leads) },
    ],
    []
  );
  return <DataTable columns={colunas} data={linhas} carregando={carregando} mensagemVazio={mensagemVazio} />;
}

/** Origem / mídia dos leads (GA4: sessionSource / sessionMedium do evento generate_lead). */
export function OrigemMidiaTable({
  itens,
  carregando,
  mensagemVazio,
}: {
  itens: ItemDistribuicao[];
  carregando: boolean;
  mensagemVazio: string;
}) {
  const colunas = useMemo<ColumnDef<ItemDistribuicao, unknown>[]>(
    () => [
      { accessorKey: 'rotulo', header: 'Origem/mídia' },
      { accessorKey: 'total', header: 'Cadastro', cell: ({ row }) => formatarNumero(row.original.total) },
    ],
    []
  );
  return <DataTable columns={colunas} data={itens} carregando={carregando} mensagemVazio={mensagemVazio} />;
}

/** Leads por formulário (identificador de conversão do RD Station). */
export function LeadsPorFormularioTable({
  itens,
  links,
  carregando,
  mensagemVazio,
}: {
  itens: ItemDistribuicao[];
  /** identificador do formulário → URL completa (Configurações → RD Station). */
  links: Record<string, string>;
  carregando: boolean;
  mensagemVazio: string;
}) {
  const colunas = useMemo<ColumnDef<ItemDistribuicao, unknown>[]>(
    () => [
      { accessorKey: 'rotulo', header: 'Formulário', cell: ({ row }) => row.original.rotulo || '(sem formulário)' },
      {
        id: 'link',
        header: 'Link',
        cell: ({ row }) => {
          const url = links[row.original.rotulo];
          if (!url) return SEM_DADOS;
          return (
            <a href={url} target="_blank" rel="noreferrer" title={url} className="text-primary hover:underline">
              {extrairPathDaUrl(url)}
            </a>
          );
        },
      },
      { accessorKey: 'total', header: 'Leads', cell: ({ row }) => formatarNumero(row.original.total) },
    ],
    [links]
  );
  return <DataTable columns={colunas} data={itens} carregando={carregando} mensagemVazio={mensagemVazio} />;
}

/** Caminho até o cadastro na ordem real da visita (GA4: landingPage, pageReferrer e pagePath do evento generate_lead) — ver sequenciaDoCaminho. */
export function CaminhosCard({ caminhos, carregando }: { caminhos: JornadaDoLead['caminhos']; carregando: boolean }) {
  const maior = Math.max(...caminhos.map((caminho) => caminho.leads), 1);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Caminhos até o lead</CardTitle>
        <PlatformIcon plataforma="ga4" className="h-3.5 w-3.5" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {carregando ? (
          Array.from({ length: 4 }).map((_, indice) => <Skeleton key={indice} className="h-8 w-full" />)
        ) : caminhos.length === 0 ? (
          <p className="text-sm text-muted-foreground">sem dados neste período — tente ampliar o intervalo</p>
        ) : (
          caminhos.map((caminho) => (
            <div key={`${caminho.entrada}|${caminho.anterior}|${caminho.cadastro}`} className="flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {sequenciaDoCaminho(caminho).map((pagina, indice) => (
                    <Fragment key={`${indice}-${pagina}`}>
                      {indice > 0 && <span className="text-muted-foreground">→</span>}
                      <span className="truncate rounded bg-muted px-1.5 py-0.5" title={pagina}>
                        {pagina}
                      </span>
                    </Fragment>
                  ))}
                  <span className="shrink-0 text-muted-foreground">→ cadastro</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatarNumero(caminho.leads)} leads</span>
              </div>
              <div className="h-1.5 rounded bg-muted">
                <div className="h-1.5 rounded" style={{ width: `${(caminho.leads / maior) * 100}%`, background: 'var(--series-1)' }} />
              </div>
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground">
          Mostra a página de entrada, a página visitada logo antes do cadastro e a página do cadastro — só dos formulários (com link cadastrado) das contas selecionadas. O caminho completo, passo a passo, exige o export do GA4 para o BigQuery.
        </p>
      </CardContent>
    </Card>
  );
}

/** Cards de tempo até converter e novos x recorrentes, mais a distribuição por faixa de dias. */
export function ConversaoCards({ jornada, carregando }: { jornada: JornadaDoLead; carregando: boolean }) {
  const v = (formatado: string, tem: boolean) => (tem ? formatado : SEM_DADOS);
  const dias = jornada.mediaDiasAteConverter;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <KpiCard
        titulo="Tempo médio até converter"
        valor={v(`${(dias ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`, dias !== null)}
        carregando={carregando}
        plataformas={['ga4']}
      />
      <KpiCard
        titulo="Leads de usuários novos"
        valor={v(formatarPercentual(jornada.fracaoNovos), jornada.fracaoNovos !== null)}
        carregando={carregando}
        plataformas={['ga4']}
      />
      <DistribuicaoCard titulo="Tempo até converter" itens={jornada.faixasTempo} carregando={carregando} plataformas={['ga4']} />
    </div>
  );
}
