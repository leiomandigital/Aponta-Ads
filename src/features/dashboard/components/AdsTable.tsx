import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/utils/formatters';

export interface AnuncioLinha {
  campaign_id: string;
  adset_id: string;
  ad_id: string;
  ad_name: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
}

interface AdsTableProps {
  anuncios: AnuncioLinha[];
  carregando: boolean;
  mensagemVazio: string;
  anuncioSelecionadoId?: string | null;
  aoSelecionarAnuncio?: (anuncio: AnuncioLinha) => void;
}

export function AdsTable({ anuncios, carregando, mensagemVazio, anuncioSelecionadoId, aoSelecionarAnuncio }: AdsTableProps) {
  const colunas = useMemo<ColumnDef<AnuncioLinha, unknown>[]>(
    () => [
      {
        accessorKey: 'ad_name',
        header: 'Anúncio',
        cell: ({ row }) => row.original.ad_name ?? row.original.ad_id,
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
      data={anuncios}
      carregando={carregando}
      mensagemVazio={mensagemVazio}
      aoClicarLinha={aoSelecionarAnuncio}
      idDaLinha={(linha) => `${linha.campaign_id}:${linha.adset_id}:${linha.ad_id}`}
      idDaLinhaSelecionada={anuncioSelecionadoId}
    />
  );
}
