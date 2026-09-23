import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/lib/theme';

const OPCOES = [
  { valor: 'light' as const, rotulo: 'Claro', icone: Sun },
  { valor: 'dark' as const, rotulo: 'Escuro', icone: Moon },
  { valor: 'system' as const, rotulo: 'Automático (sistema)', icone: Monitor },
];

export function ThemeToggle() {
  const { tema, temaEfetivo, definirTema } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Aparência">
          {temaEfetivo === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <span className="sr-only">Alternar tema claro/escuro</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPCOES.map((opcao) => (
          <DropdownMenuItem key={opcao.valor} onClick={() => definirTema(opcao.valor)}>
            <opcao.icone className="mr-2 h-4 w-4" />
            {opcao.rotulo}
            {tema === opcao.valor && <span className="ml-auto text-xs text-muted-foreground">Atual</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
