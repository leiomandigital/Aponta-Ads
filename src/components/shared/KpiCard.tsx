import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatarPercentual } from '@/utils/formatters';
import type { ComparacaoPeriodo } from '@/utils/metricsAggregation';

interface KpiCardComparacao extends ComparacaoPeriodo {
  formatarDelta: (valor: number) => string;
  /** Se um valor MAIOR é bom para essa métrica (padrão 'up' — ex.: Custo deve usar 'down'). */
  direcaoBoa?: 'up' | 'down';
}

interface KpiCardProps {
  titulo: string;
  valor: string;
  carregando?: boolean;
  comparacao?: KpiCardComparacao | null;
}

export function KpiCard({ titulo, valor, carregando, comparacao }: KpiCardProps) {
  const semVariacao = comparacao && comparacao.delta === 0 && comparacao.percentual === null;
  const mostrarComparacao = comparacao && !carregando && !semVariacao;

  const subiu = comparacao ? comparacao.delta > 0 : false;
  const direcaoBoa = comparacao?.direcaoBoa ?? 'up';
  const ehPositivo = comparacao?.delta === 0 ? null : subiu === (direcaoBoa === 'up');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{titulo}</CardDescription>
        {carregando ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <CardTitle className="text-2xl font-semibold tabular-nums">{valor}</CardTitle>
        )}
        {mostrarComparacao && (
          <p
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              ehPositivo === null
                ? 'text-muted-foreground'
                : ehPositivo
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-destructive'
            )}
          >
            {subiu ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {comparacao.percentual !== null ? formatarPercentual(Math.abs(comparacao.percentual)) : 'novo'}
            <span className="font-normal text-muted-foreground">
              ({comparacao.delta >= 0 ? '+' : ''}
              {comparacao.formatarDelta(comparacao.delta)} vs. período anterior)
            </span>
          </p>
        )}
      </CardHeader>
    </Card>
  );
}
