import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppSidebar } from './AppSidebar';
import { NavUser } from './NavUser';
import { ThemeToggle } from './ThemeToggle';

interface SiteHeaderProps {
  titulo: string;
}

export function SiteHeader({ titulo }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
          <AppSidebar />
        </SheetContent>
      </Sheet>

      <Separator orientation="vertical" className="hidden h-5 md:block" />

      <h1 className="flex-1 truncate text-sm font-medium">{titulo}</h1>

      <ThemeToggle />
      <NavUser />
    </header>
  );
}
