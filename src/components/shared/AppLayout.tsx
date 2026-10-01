import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useSidebarRecolhida } from '@/hooks/useSidebarRecolhida';
import { AppSidebar } from './AppSidebar';
import { SiteHeader } from './SiteHeader';

interface AppLayoutProps {
  titulo: string;
  children: ReactNode;
}

export function AppLayout({ titulo, children }: AppLayoutProps) {
  const { recolhida, alternar } = useSidebarRecolhida();

  return (
    <div className="flex min-h-svh w-full">
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 self-start overflow-y-auto overflow-x-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:block',
          recolhida ? 'w-16' : 'w-64'
        )}
      >
        <AppSidebar recolhida={recolhida} aoAlternarRecolhimento={alternar} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <SiteHeader titulo={titulo} />
        {/*
          overflow-x-clip (não overflow-x-hidden): "hidden" em qualquer eixo
          obriga o navegador a tratar esta <main> como um contêiner de rolagem
          próprio (o outro eixo vira "auto" por regra do CSS), mesmo sem nunca
          rolar de verdade — isso quebra `position: sticky` de tudo lá dentro,
          porque passa a grudar relativo a essa caixa parada, não à janela real
          (só o SiteHeader, que fica FORA daqui, gruda certo). "clip" corta o
          overflow horizontal sem esse efeito colateral.
        */}
        <main className="flex-1 overflow-x-clip p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
