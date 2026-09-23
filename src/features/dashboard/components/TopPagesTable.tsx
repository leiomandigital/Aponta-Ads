import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable';
import { formatarNumero } from '@/utils/formatters';

export interface PaginaLinha {
  page_path: string;
  sessions: number;
}

interface TopPagesTableProps {
  paginas: PaginaLinha[];
  carregando: boolean;
  mensagemVazio: string;
}

export function TopPagesTable({ paginas, carregando, mensagemVazio }: TopPagesTableProps) {
  const colunas = useMemo<ColumnDef<PaginaLinha, unknown>[]>(
    () => [
      { accessorKey: 'page_path', header: 'Página' },
      { accessorKey: 'sessions', header: 'Sessões', cell: ({ row }) => formatarNumero(row.original.sessions) },
    ],
    []
  );

  return <DataTable columns={colunas} data={paginas} carregando={carregando} mensagemVazio={mensagemVazio} />;
}
