import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatarData } from '@/utils/formatters';

export interface SerieDoGrafico {
  chave: string;
  rotulo: string;
  cor: string; // var(--series-N)
  formatarValor: (valor: number) => string;
}

interface ChartAreaInteractiveProps<TPonto extends { date: string }> {
  titulo: string;
  descricao: string;
  dados: TPonto[];
  series: SerieDoGrafico[];
  carregando: boolean;
}

function TooltipPersonalizado({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
  series: SerieDoGrafico[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-md"
      style={{ background: 'var(--chart-surface)', borderColor: 'var(--chart-gridline)', color: 'var(--chart-ink-primary)' }}
    >
      <p className="mb-1 font-medium">{formatarData(label ?? '')}</p>
      {payload.map((item) => {
        const serie = series.find((s) => s.chave === item.dataKey);
        if (!serie) return null;
        return (
          <p key={item.dataKey} className="flex items-center gap-2" style={{ color: 'var(--chart-ink-secondary)' }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: serie.cor }} />
            {serie.rotulo}: <span style={{ color: 'var(--chart-ink-primary)' }}>{serie.formatarValor(item.value)}</span>
          </p>
        );
      })}
    </div>
  );
}

export function ChartAreaInteractive<TPonto extends { date: string }>({
  titulo,
  descricao,
  dados,
  series,
  carregando,
}: ChartAreaInteractiveProps<TPonto>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <Skeleton className="h-[300px] w-full" />
        ) : dados.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Sem dados neste período — tente ampliar o intervalo
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dados} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
              <defs>
                {series.map((serie) => (
                  <linearGradient key={serie.chave} id={`preenchimento-${serie.chave}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={serie.cor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={serie.cor} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-gridline)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatarData}
                tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<TooltipPersonalizado series={series} />} />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                formatter={(valor) => <span style={{ color: 'var(--chart-ink-secondary)' }}>{valor}</span>}
              />
              {series.map((serie) => (
                <Area
                  key={serie.chave}
                  type="monotone"
                  dataKey={serie.chave}
                  name={serie.rotulo}
                  stroke={serie.cor}
                  strokeWidth={2}
                  fill={`url(#preenchimento-${serie.chave})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
