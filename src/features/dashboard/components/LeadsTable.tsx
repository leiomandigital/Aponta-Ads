import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatarData } from '@/utils/formatters';

interface LeadLinha {
  id: string;
  name: string | null;
  email: string | null;
  source: string | null;
  funnel_stage: string | null;
  region: 'ES' | 'TO' | null;
  captured_at: string | null;
}

interface LeadsTableProps {
  leads: LeadLinha[];
  carregando: boolean;
  mensagemVazio: string;
}

// PII de lead (nome/e-mail) só aparece aqui, atrás de login — nunca no PDF
// exportado (ver Data Security Skill).
export function LeadsTable({ leads, carregando, mensagemVazio }: LeadsTableProps) {
  const colunas = useMemo<ColumnDef<LeadLinha, unknown>[]>(
    () => [
      { accessorKey: 'name', header: 'Nome', cell: ({ row }) => row.original.name ?? '—' },
      { accessorKey: 'email', header: 'E-mail', cell: ({ row }) => row.original.email ?? '—' },
      {
        accessorKey: 'source',
        header: 'Origem',
        cell: ({ row }) => (row.original.source ? <Badge variant="secondary">{row.original.source}</Badge> : '—'),
      },
      { accessorKey: 'funnel_stage', header: 'Etapa', cell: ({ row }) => row.original.funnel_stage ?? '—' },
      {
        accessorKey: 'region',
        header: 'Região',
        cell: ({ row }) => (row.original.region ? <Badge variant="outline">{row.original.region}</Badge> : '—'),
      },
      {
        accessorKey: 'captured_at',
        header: 'Capturado em',
        cell: ({ row }) => formatarData(row.original.captured_at),
      },
    ],
    []
  );

  return <DataTable columns={colunas} data={leads} carregando={carregando} mensagemVazio={mensagemVazio} />;
}
