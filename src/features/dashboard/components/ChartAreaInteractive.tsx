import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformIcon } from '@/components/shared/icons/PlatformIcon';
import type { IntegrationKey } from '@/types/database.types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatarData } from '@/utils/formatters';

export interface SerieDoGrafico {
  chave: string;
  rotulo: string;
  cor: string; // var(--series-N)
  /** Eixo vertical da série: 'direita' usa uma escala própria (ex.: leads por dia junto do custo por lead). Padrão 'esquerda'. */
  eixo?: 'esquerda' | 'direita';
  /** Como a série é desenhada quando o gráfico mistura formas (ex.: custo por conversão em linha e conversões em barras). Padrão: área. */
  forma?: 'area' | 'linha' | 'barras';
  formatarValor: (valor: number) => string;
}

interface ChartAreaInteractiveProps<TPonto extends { date: string }> {
  titulo: string;
  descricao: string;
  dados: TPonto[];
  series: SerieDoGrafico[];
  carregando: boolean;
  /** Integração(ões) de onde vem o dado, exibida(s) como logo no canto do cabeçalho. */
  plataformas?: IntegrationKey[];
  /** 'barras' desenha colunas (ex.: leads por dia); padrão 'area'. */
  tipo?: 'area' | 'barras';
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

// Até esse número de pontos (7 dias) toda data do eixo aparece e todo ponto tem rótulo.
const LIMITE_PONTOS_COM_TODAS_AS_DATAS = 10;
// Largura aproximada (px) que cada data do eixo + o valor em cima dela ocupam.
const LARGURA_POR_ROTULO = 95;

/** De quantos em quantos pontos há uma data no eixo (e, junto, o valor na linha) para a largura disponível. */
function passoDoEixo(totalPontos: number, largura: number): number {
  if (totalPontos <= LIMITE_PONTOS_COM_TODAS_AS_DATAS) return 1;
  const maximoDeRotulos = Math.max(3, Math.floor(largura / LARGURA_POR_ROTULO));
  return Math.ceil(totalPontos / maximoDeRotulos);
}

interface PropsDoRotulo {
  x?: number;
  y?: number;
  width?: number;
  value?: number | string | null;
  index?: number;
}

/** Rótulo com o valor sobre um ponto da linha/área — só onde há data no eixo (mesmo passo do XAxis). */
function rotuloDePonto(serie: SerieDoGrafico, passo: number, ultimoIndice: number) {
  return function RotuloDePonto({ x, y, value, index }: PropsDoRotulo) {
    if (typeof x !== 'number' || typeof y !== 'number' || typeof value !== 'number' || index === undefined) return <g />;
    if (index % passo !== 0) return <g />;
    return (
      <text
        x={x}
        y={y - 8}
        textAnchor={index === 0 ? 'start' : index > ultimoIndice - passo / 2 ? 'end' : 'middle'}
        fontSize={11}
        fontWeight={500}
        fill="var(--chart-ink-primary)"
      >
        {serie.formatarValor(value)}
      </text>
    );
  };
}

/** Rótulo com o valor sobre uma barra — só onde há data no eixo (mesmo passo do XAxis). */
function rotuloDeBarra(serie: SerieDoGrafico, passo: number, ultimoIndice: number) {
  return function RotuloDeBarra({ x, y, width, value, index }: PropsDoRotulo) {
    if (typeof x !== 'number' || typeof y !== 'number' || typeof value !== 'number' || index === undefined) return <g />;
    if (index % passo !== 0) return <g />;
    const noFim = index > ultimoIndice - passo / 2;
    return (
      <text
        x={noFim ? x + (width ?? 0) : x + (width ?? 0) / 2}
        y={y - 6}
        textAnchor={noFim ? 'end' : 'middle'}
        fontSize={11}
        fontWeight={500}
        fill="var(--chart-ink-primary)"
      >
        {serie.formatarValor(value)}
      </text>
    );
  };
}

export function ChartAreaInteractive<TPonto extends { date: string }>({
  titulo,
  descricao,
  dados,
  series,
  carregando,
  plataformas,
  tipo = 'area',
}: ChartAreaInteractiveProps<TPonto>) {
  const [largura, setLargura] = useState(900);
  const passo = passoDoEixo(dados.length, largura);
  const ultimoIndice = dados.length - 1;
  const temEixoDireito = series.some((serie) => serie.eixo === 'direita');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{titulo}</CardTitle>
          {plataformas && plataformas.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {plataformas.map((plataforma) => (
                <PlatformIcon key={plataforma} plataforma={plataforma} className="h-4 w-4" />
              ))}
            </div>
          )}
        </div>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <Skeleton className="h-[300px] w-full" />
        ) : dados.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Sem dados neste período — tente ampliar o intervalo
          </div>
        ) : series.some((serie) => serie.forma === 'linha' || serie.forma === 'barras') ? (
          <ResponsiveContainer width="100%" height={300} onResize={(novaLargura) => setLargura(novaLargura)}>
            <ComposedChart data={dados} margin={{ left: 0, right: temEixoDireito ? 0 : 12, top: 24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-gridline)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatarData}
                tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={passo - 1}
              />
              <YAxis yAxisId="esquerda" tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              {temEixoDireito && (
                <YAxis
                  yAxisId="direita"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
              )}
              <Tooltip content={<TooltipPersonalizado series={series} />} />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                formatter={(valor) => <span style={{ color: 'var(--chart-ink-secondary)' }}>{valor}</span>}
              />
              {/* barras primeiro, para a linha ficar desenhada por cima delas */}
              {series
                .filter((serie) => serie.forma === 'barras')
                .map((serie) => (
                  <Bar
                    key={serie.chave}
                    dataKey={serie.chave}
                    yAxisId={serie.eixo === 'direita' ? 'direita' : 'esquerda'}
                    name={serie.rotulo}
                    fill={serie.cor}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                    label={rotuloDeBarra(serie, passo, ultimoIndice)}
                  />
                ))}
              {series
                .filter((serie) => serie.forma !== 'barras')
                .map((serie) => (
                  <Line
                    key={serie.chave}
                    type="monotone"
                    dataKey={serie.chave}
                    yAxisId={serie.eixo === 'direita' ? 'direita' : 'esquerda'}
                    connectNulls
                    name={serie.rotulo}
                    stroke={serie.cor}
                    strokeWidth={2}
                    dot={false}
                    label={rotuloDePonto(serie, passo, ultimoIndice)}
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : tipo === 'barras' ? (
          <ResponsiveContainer width="100%" height={300} onResize={(novaLargura) => setLargura(novaLargura)}>
            <BarChart data={dados} margin={{ left: 0, right: 12, top: 24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-gridline)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatarData}
                tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={passo - 1}
              />
              <YAxis yAxisId="esquerda" allowDecimals={false} tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<TooltipPersonalizado series={series} />} cursor={{ fill: 'var(--chart-gridline)', opacity: 0.4 }} />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                formatter={(valor) => <span style={{ color: 'var(--chart-ink-secondary)' }}>{valor}</span>}
              />
              {series.map((serie) => (
                <Bar
                  key={serie.chave}
                  dataKey={serie.chave}
                  yAxisId="esquerda"
                  name={serie.rotulo}
                  fill={serie.cor}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={24}
                  label={rotuloDeBarra(serie, passo, ultimoIndice)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300} onResize={(novaLargura) => setLargura(novaLargura)}>
            <AreaChart data={dados} margin={{ left: 0, right: temEixoDireito ? 0 : 12, top: 24, bottom: 0 }}>
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
                interval={passo - 1}
              />
              <YAxis yAxisId="esquerda" tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              {temEixoDireito && (
                <YAxis
                  yAxisId="direita"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fill: 'var(--chart-ink-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
              )}
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
                  yAxisId={serie.eixo === 'direita' ? 'direita' : 'esquerda'}
                  connectNulls
                  name={serie.rotulo}
                  stroke={serie.cor}
                  strokeWidth={2}
                  fill={`url(#preenchimento-${serie.chave})`}
                  label={rotuloDePonto(serie, passo, ultimoIndice)}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
