import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/utils/formatters';

export interface ConjuntoLinha {
  campaign_id: string;
  adset_id: string;
  adset_name: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
}

interface AdSetsTableProps {
  conjuntos: ConjuntoLinha[];
  carregando: boolean;
  mensagemVazio: string;
  conjuntoSelecionadoId?: string | null;
  aoSelecionarConjunto?: (conjunto: ConjuntoLinha) => void;
}

export function AdSetsTable({ conjuntos, carregando, mensagemVazio, conjuntoSelecionadoId, aoSelecionarConjunto }: AdSetsTableProps) {
  const colunas = useMemo<ColumnDef<ConjuntoLinha, unknown>[]>(
    () => [
      {
        accessorKey: 'adset_name',
        header: 'Conjunto de anúncio',
        cell: ({ row }) => row.original.adset_name ?? row.original.adset_id,
      },
      { accessorKey: 'impressions', header: 'Impressões', cell: ({ row }) => formatarNumero(row.original.impressions) },
      { accessorKey: 'clicks', header: 'Cliques', cell: ({ row }) => formatarNumero(row.original.clicks) },
      { accessorKey: 'cost', header: 'Custo', cell: ({ row }) => formatarMoeda(row.original.cost) },
      { accessorKey: 'conversions', header: 'Conversões', cell: ({ row }) => formatarNumero(row.original.conversions) },
      { accessorKey: 'cpm', header: 'CPM', cell: ({ row }) => formatarMoeda(row.original.cpm) },
      { accessorKey: 'ctr', header: 'CTR', cell: ({ row }) => formatarPercentual(row.original.ctr) },
      { accessorKey: 'cpc', header: 'CPC', cell: ({ row }) => formatarMoeda(row.original.cpc) },
    ],
    []
  );

  return (
    <DataTable
      columns={colunas}
      data={conjuntos}
      carregando={carregando}
      mensagemVazio={mensagemVazio}
      aoClicarLinha={aoSelecionarConjunto}
      idDaLinha={(linha) => `${linha.campaign_id}:${linha.adset_id}`}
      idDaLinhaSelecionada={conjuntoSelecionadoId}
    />
  );
}
