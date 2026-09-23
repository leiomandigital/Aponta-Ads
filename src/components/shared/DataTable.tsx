import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DataTableProps<TDado, TValor> {
  columns: ColumnDef<TDado, TValor>[];
  data: TDado[];
  carregando: boolean;
  mensagemVazio: string;
  /** Presente = linhas ficam clicáveis (cursor + destaque ao passar o mouse). */
  aoClicarLinha?: (linha: TDado) => void;
  /** Identifica a linha atualmente selecionada, para destacá-la — precisa de `idDaLinha`. */
  idDaLinhaSelecionada?: string | null;
  idDaLinha?: (linha: TDado) => string;
}

export function DataTable<TDado, TValor = unknown>({
  columns,
  data,
  carregando,
  mensagemVazio,
  aoClicarLinha,
  idDaLinhaSelecionada,
  idDaLinha,
}: DataTableProps<TDado, TValor>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const tabela = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (carregando) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, indice) => (
          <Skeleton key={indice} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {tabela.getHeaderGroups().map((grupo) => (
            <TableRow key={grupo.id}>
              {grupo.headers.map((cabecalho) => (
                <TableHead key={cabecalho.id}>
                  {cabecalho.isPlaceholder ? null : cabecalho.column.getCanSort() ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8"
                      onClick={() => cabecalho.column.toggleSorting(cabecalho.column.getIsSorted() === 'asc')}
                    >
                      {flexRender(cabecalho.column.columnDef.header, cabecalho.getContext())}
                      <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    flexRender(cabecalho.column.columnDef.header, cabecalho.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {tabela.getRowModel().rows.length > 0 ? (
            tabela.getRowModel().rows.map((linha) => {
              const id = idDaLinha?.(linha.original);
              const selecionada = id !== undefined && id === idDaLinhaSelecionada;
              return (
                <TableRow
                  key={linha.id}
                  onClick={aoClicarLinha ? () => aoClicarLinha(linha.original) : undefined}
                  className={cn(aoClicarLinha && 'cursor-pointer hover:bg-muted/50', selecionada && 'bg-muted')}
                >
                  {linha.getVisibleCells().map((celula) => (
                    <TableCell key={celula.id}>{flexRender(celula.column.columnDef.cell, celula.getContext())}</TableCell>
                  ))}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {mensagemVazio}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
