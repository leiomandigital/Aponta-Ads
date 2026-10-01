import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { PlatformIcon } from '@/components/shared/icons/PlatformIcon';
import { Badge } from '@/components/ui/badge';
import type { IntegrationKey } from '@/types/database.types';
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/utils/formatters';
import type { CampanhaLinha } from '@/utils/painelCalculos';

export type { CampanhaLinha };

const ROTULO_PLATAFORMA: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

interface CampaignsTableProps {
  campanhas: CampanhaLinha[];
  carregando: boolean;
  mensagemVazio: string;
  /** 'google_ads'/'meta_ads': sem coluna Plataforma, mesma ordem do comparativo de plataformas e custo/conversão sobre o custo total. */
  modo?: 'padrao' | 'google_ads' | 'meta_ads';
}

export function CampaignsTable({ campanhas, carregando, mensagemVazio, modo = 'padrao' }: CampaignsTableProps) {
  const colunas = useMemo<ColumnDef<CampanhaLinha, unknown>[]>(
    () =>
      modo !== 'padrao'
        ? [
            { accessorKey: 'campaign_name', header: 'Campanha', cell: ({ row }) => row.original.campaign_name ?? row.original.campaign_id },
            { accessorKey: 'cost', header: modo === 'meta_ads' ? 'Custo de mídia' : 'Custo', cell: ({ row }) => formatarMoeda(row.original.cost) },
            ...(modo === 'meta_ads'
              ? [{ accessorKey: 'costComTaxas', header: 'Custo com taxa', cell: ({ row }) => formatarMoeda(row.original.costComTaxas) } as ColumnDef<CampanhaLinha, unknown>]
              : []),
            { accessorKey: 'costTotal', header: 'Custo total', cell: ({ row }) => formatarMoeda(row.original.costTotal) },
            { accessorKey: 'impressions', header: 'Impressões', cell: ({ row }) => formatarNumero(row.original.impressions) },
            { accessorKey: 'clicks', header: 'Cliques', cell: ({ row }) => formatarNumero(row.original.clicks) },
            { accessorKey: 'conversions', header: 'Conversões', cell: ({ row }) => formatarNumero(row.original.conversions) },
            { accessorKey: 'cpm', header: 'CPM', cell: ({ row }) => formatarMoeda(row.original.cpm) },
            { accessorKey: 'cpc', header: 'CPC', cell: ({ row }) => formatarMoeda(row.original.cpc) },
            { accessorKey: 'ctr', header: 'CTR', cell: ({ row }) => formatarPercentual(row.original.ctr) },
            {
              id: 'cpa',
              header: 'Custo/conversão',
              cell: ({ row }) => formatarMoeda(row.original.conversions > 0 ? row.original.costTotal / row.original.conversions : null),
            },
          ]
        : [
      {
        accessorKey: 'campaign_name',
        header: 'Campanha',
        cell: ({ row }) => row.original.campaign_name ?? row.original.campaign_id,
      },
      {
        accessorKey: 'platform',
        header: 'Plataforma',
        cell: ({ row }) => (
          <Badge variant="secondary" className="gap-1.5">
            <PlatformIcon plataforma={row.original.platform as IntegrationKey} className="h-3 w-3" />
            {ROTULO_PLATAFORMA[row.original.platform] ?? row.original.platform}
          </Badge>
        ),
      },
      { accessorKey: 'impressions', header: 'Impressões', cell: ({ row }) => formatarNumero(row.original.impressions) },
      { accessorKey: 'clicks', header: 'Cliques', cell: ({ row }) => formatarNumero(row.original.clicks) },
      { accessorKey: 'cost', header: 'Custo', cell: ({ row }) => formatarMoeda(row.original.cost) },
      { accessorKey: 'costComTaxas', header: 'Custo c/ taxas', cell: ({ row }) => formatarMoeda(row.original.costComTaxas) },
      { accessorKey: 'costTotal', header: 'Custo total', cell: ({ row }) => formatarMoeda(row.original.costTotal) },
      { accessorKey: 'conversions', header: 'Conversões', cell: ({ row }) => formatarNumero(row.original.conversions) },
      { accessorKey: 'cpm', header: 'CPM', cell: ({ row }) => formatarMoeda(row.original.cpm) },
      { accessorKey: 'ctr', header: 'CTR', cell: ({ row }) => formatarPercentual(row.original.ctr) },
      { accessorKey: 'cpc', header: 'CPC', cell: ({ row }) => formatarMoeda(row.original.cpc) },
        ],
    [modo]
  );

  return <DataTable columns={colunas} data={campanhas} carregando={carregando} mensagemVazio={mensagemVazio} />;
}
