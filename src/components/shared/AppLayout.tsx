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
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
