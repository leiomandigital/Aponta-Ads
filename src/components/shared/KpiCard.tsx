import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformIcon } from '@/components/shared/icons/PlatformIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatarPercentual } from '@/utils/formatters';
import type { ComparacaoPeriodo } from '@/utils/metricsAggregation';
import type { IntegrationKey } from '@/types/database.types';

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
  /** Integração(ões) de onde vem esse dado, exibida(s) como logo no canto do card. */
  plataformas?: IntegrationKey[];
}

export function KpiCard({ titulo, valor, carregando, comparacao, plataformas }: KpiCardProps) {
  const semVariacao = comparacao && comparacao.delta === 0 && comparacao.percentual === null;
  const mostrarComparacao = comparacao && !carregando && !semVariacao;

  const percentualTexto = comparacao?.percentual != null ? formatarPercentual(Math.abs(comparacao.percentual)) : 'novo';
  const subiu = comparacao ? comparacao.delta > 0 : false;
  const direcaoBoa = comparacao?.direcaoBoa ?? 'up';
  const ehPositivo = comparacao?.delta === 0 ? null : subiu === (direcaoBoa === 'up');

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription>{titulo}</CardDescription>
          {plataformas && plataformas.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {plataformas.map((plataforma) => (
                <PlatformIcon key={plataforma} plataforma={plataforma} className="h-3.5 w-3.5" />
              ))}
            </div>
          )}
        </div>
        {carregando ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <CardTitle className="text-2xl font-semibold tabular-nums">{valor}</CardTitle>
        )}
        {mostrarComparacao && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className={cn(
                  'flex w-fit cursor-default items-center gap-1 text-xs font-medium',
                  ehPositivo === null
                    ? 'text-muted-foreground'
                    : ehPositivo
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-destructive'
                )}
              >
                {subiu ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {percentualTexto}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              {percentualTexto} ({comparacao.delta >= 0 ? '+' : ''}
              {comparacao.formatarDelta(comparacao.delta)} vs. período anterior)
            </TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
    </Card>
  );
}
