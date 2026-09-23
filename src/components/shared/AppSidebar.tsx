import { LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ITENS_NAV = [
  { rotulo: 'Dashboard', href: '/dashboard', icone: LayoutDashboard },
  { rotulo: 'Configurações', href: '/settings/integrations', icone: Settings },
];

interface AppSidebarProps {
  className?: string;
  aoNavegar?: () => void;
  recolhida?: boolean;
  /** Sem esta função o botão de recolher não aparece (ex.: menu do celular). */
  aoAlternarRecolhimento?: () => void;
}

export function AppSidebar({ className, aoNavegar, recolhida = false, aoAlternarRecolhimento }: AppSidebarProps) {
  const rotuloAlternar = recolhida ? 'Expandir menu' : 'Recolher menu';
  const IconeAlternar = recolhida ? PanelLeftOpen : PanelLeftClose;

  return (
    <nav className={cn('flex h-full flex-col gap-1 p-3', className)}>
      <div className={cn('flex items-center py-3', recolhida ? 'justify-center' : 'justify-between px-2')}>
        {!recolhida && <span className="whitespace-nowrap text-lg font-semibold tracking-tight">ApontaAds</span>}
        {aoAlternarRecolhimento && (
          <Button
            variant="ghost"
            size="icon"
            onClick={aoAlternarRecolhimento}
            title={rotuloAlternar}
            className="h-8 w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <IconeAlternar className="h-4 w-4" />
            <span className="sr-only">{rotuloAlternar}</span>
          </Button>
        )}
      </div>
      {ITENS_NAV.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          onClick={aoNavegar}
          title={recolhida ? item.rotulo : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 whitespace-nowrap rounded-md py-2 text-sm font-medium transition-colors',
              recolhida ? 'justify-center px-0' : 'px-3',
              isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
            )
          }
        >
          <item.icone className="h-4 w-4 shrink-0" />
          {recolhida ? <span className="sr-only">{item.rotulo}</span> : item.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
