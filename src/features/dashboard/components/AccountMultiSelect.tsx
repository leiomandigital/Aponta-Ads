import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Account } from '@/types/database.types';

interface AccountMultiSelectProps {
  contas: Account[];
  /** null = todas (padrão). Lista = só essas contas, somadas. */
  selecionadas: string[] | null;
  aoAlterar: (ids: string[] | null) => void;
}

export function AccountMultiSelect({ contas, selecionadas, aoAlterar }: AccountMultiSelectProps) {
  const todasMarcadas = selecionadas === null || selecionadas.length === contas.length;
  const idsMarcados = selecionadas ?? contas.map((conta) => conta.id);

  const rotulo = todasMarcadas
    ? 'Todas as contas'
    : selecionadas && selecionadas.length === 1
      ? (contas.find((conta) => conta.id === selecionadas[0])?.name ?? '1 conta')
      : `${selecionadas?.length ?? 0} de ${contas.length} contas`;

  const alternarConta = (id: string, marcada: boolean) => {
    const proximas = marcada ? [...idsMarcados, id] : idsMarcados.filter((atual) => atual !== id);
    // Nunca deixa zerar: sem nenhuma conta o dashboard ficaria vazio sem explicação.
    if (proximas.length === 0) return;
    aoAlterar(proximas.length === contas.length ? null : proximas);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[150px] justify-between sm:w-[190px]">
          <span className="truncate">{rotulo}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuCheckboxItem
          checked={todasMarcadas}
          onSelect={(evento) => evento.preventDefault()}
          onCheckedChange={() => aoAlterar(null)}
        >
          Todas as contas
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {contas.map((conta) => (
          <DropdownMenuCheckboxItem
            key={conta.id}
            checked={idsMarcados.includes(conta.id)}
            onSelect={(evento) => evento.preventDefault()}
            onCheckedChange={(marcada) => alternarConta(conta.id, marcada === true)}
          >
            {conta.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
