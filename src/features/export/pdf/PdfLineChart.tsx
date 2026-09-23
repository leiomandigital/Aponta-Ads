import { Line, Path, Polyline, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';

interface PontoGrafico {
  date: string;
  valor: number;
}

interface PdfLineChartProps {
  titulo: string;
  dados: PontoGrafico[];
  cor: string;
  formatarValor: (valor: number) => string;
  formatarData: (data: string) => string;
}

const LARGURA = 240;
const ALTURA = 90;
const PADDING_LATERAL = 4;
const PADDING_TOPO = 8;
const PADDING_BASE = 4;

const estilos = StyleSheet.create({
  container: { width: '48%' },
  titulo: { fontSize: 9, fontWeight: 700, marginBottom: 3 },
  vazio: {
    height: ALTURA,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e1e0d9',
    borderRadius: 4,
  },
  vazioTexto: { fontSize: 8, color: '#898781' },
  legendaLinha: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  legendaTexto: { fontSize: 7, color: '#898781' },
});

// Gráfico de linha/área desenhado à mão com as primitivas SVG do
// @react-pdf/renderer — não há como usar Recharts (React DOM) dentro do
// PDF, então a geometria é calculada aqui mesmo. Uma métrica por gráfico
// (eixo único) em vez de combinar duas escalas diferentes no mesmo eixo.
export function PdfLineChart({ titulo, dados, cor, formatarValor, formatarData }: PdfLineChartProps) {
  if (dados.length === 0) {
    return (
      <View style={estilos.container}>
        <Text style={estilos.titulo}>{titulo}</Text>
        <View style={estilos.vazio}>
          <Text style={estilos.vazioTexto}>Sem dados neste período</Text>
        </View>
      </View>
    );
  }

  const valores = dados.map((ponto) => ponto.valor);
  const maximo = Math.max(...valores, 1);
  const larguraUtil = LARGURA - PADDING_LATERAL * 2;
  const alturaUtil = ALTURA - PADDING_TOPO - PADDING_BASE;
  const linhaBase = PADDING_TOPO + alturaUtil;

  const coordenadas = dados.map((ponto, indice) => {
    const x = PADDING_LATERAL + (dados.length > 1 ? (indice / (dados.length - 1)) * larguraUtil : larguraUtil / 2);
    const y = PADDING_TOPO + alturaUtil - (ponto.valor / maximo) * alturaUtil;
    return { x, y };
  });

  const pontosPolyline = coordenadas.map((ponto) => `${ponto.x},${ponto.y}`).join(' ');
  const caminhoArea = `M ${PADDING_LATERAL},${linhaBase} L ${coordenadas
    .map((ponto) => `${ponto.x},${ponto.y}`)
    .join(' L ')} L ${PADDING_LATERAL + larguraUtil},${linhaBase} Z`;

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>{titulo}</Text>
      <Svg width={LARGURA} height={ALTURA} viewBox={`0 0 ${LARGURA} ${ALTURA}`}>
        <Line x1={PADDING_LATERAL} y1={linhaBase} x2={PADDING_LATERAL + larguraUtil} y2={linhaBase} stroke="#e1e0d9" strokeWidth={1} />
        <Path d={caminhoArea} fill={cor} fillOpacity={0.15} />
        <Polyline points={pontosPolyline} fill="none" stroke={cor} strokeWidth={1.5} />
      </Svg>
      <View style={estilos.legendaLinha}>
        <Text style={estilos.legendaTexto}>{formatarData(dados[0].date)}</Text>
        <Text style={estilos.legendaTexto}>Máx.: {formatarValor(maximo)}</Text>
        <Text style={estilos.legendaTexto}>{formatarData(dados[dados.length - 1].date)}</Text>
      </View>
    </View>
  );
}
