import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/utils/formatters';

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
}

const ROTULO_PLATAFORMA: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

interface CampaignsTableProps {
  campanhas: CampanhaLinha[];
  carregando: boolean;
  mensagemVazio: string;
  campanhaSelecionadaId?: string | null;
  aoSelecionarCampanha?: (campanha: CampanhaLinha) => void;
}

export function CampaignsTable({
  campanhas,
  carregando,
  mensagemVazio,
  campanhaSelecionadaId,
  aoSelecionarCampanha,
}: CampaignsTableProps) {
  const colunas = useMemo<ColumnDef<CampanhaLinha, unknown>[]>(
    () => [
      {
        accessorKey: 'campaign_name',
        header: 'Campanha',
        cell: ({ row }) => row.original.campaign_name ?? row.original.campaign_id,
      },
      {
        accessorKey: 'platform',
        header: 'Plataforma',
        cell: ({ row }) => <Badge variant="secondary">{ROTULO_PLATAFORMA[row.original.platform] ?? row.original.platform}</Badge>,
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
      data={campanhas}
      carregando={carregando}
      mensagemVazio={mensagemVazio}
      aoClicarLinha={aoSelecionarCampanha}
      idDaLinha={(linha) => `${linha.platform}:${linha.campaign_id}`}
      idDaLinhaSelecionada={campanhaSelecionadaId}
    />
  );
}
