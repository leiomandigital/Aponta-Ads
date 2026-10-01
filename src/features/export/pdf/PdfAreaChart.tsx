import { G, Line, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { IntegrationKey } from '../../../types/database.types.js';
import { PlatformIconPdf } from './PlatformIconPdf.js';

export interface SeriePdf {
  chave: string;
  rotulo: string;
  cor: string;
  formatarValor: (valor: number) => string;
  /** 'direita' = escala própria, desenhada no eixo da direita. Padrão 'esquerda'. */
  eixo?: 'esquerda' | 'direita';
}

interface PdfAreaChartProps {
  titulo: string;
  descricao?: string;
  dados: Array<{ date: string } & Record<string, unknown>>;
  series: SeriePdf[];
  formatarData: (data: string) => string;
  /** Integração(ões) de onde vem o dado, exibida(s) como logo no canto do título — igual ao gráfico do dashboard. */
  plataformas?: IntegrationKey[];
}

const LARGURA = 531; // A4 (595) menos o padding horizontal da página (2 × 32)
const ALTURA = 170;
const MARGEM = { esquerda: 38, direita: 14, topo: 22, base: 20 };
const MARGEM_DIREITA_COM_EIXO = 34;
const FONTE = 'Montserrat';

// Os tipos do @react-pdf não declaram fontSize/fontFamily/fontWeight no <Text> de dentro do <Svg>, mas o
// renderer os lê normalmente — por isso entram por spread tipado como object.
const fonte = (tamanho: number, peso?: number) => ({ fontSize: tamanho, fontFamily: FONTE, ...(peso ? { fontWeight: peso } : {}) }) as object;

// Mesma regra do gráfico do dashboard (ChartAreaInteractive): até 10 pontos toda data do eixo tem valor;
// acima disso, uma data (e o valor sobre a linha) a cada `passo` pontos.
const LIMITE_PONTOS_COM_TODAS_AS_DATAS = 10;
const LARGURA_POR_ROTULO = 62;

function passoDoEixo(totalPontos: number): number {
  if (totalPontos <= LIMITE_PONTOS_COM_TODAS_AS_DATAS) return 1;
  return Math.ceil(totalPontos / Math.max(3, Math.floor(LARGURA / LARGURA_POR_ROTULO)));
}

/** Teto "redondo" do eixo Y e o passo entre as linhas de grade (4 intervalos, como o recharts do dashboard). */
function escalaY(maximo: number) {
  if (maximo <= 0) return { teto: 1, passo: 0.25 };
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const normalizado = bruto / potencia;
  const passoBase = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 2.5 ? 2.5 : normalizado <= 5 ? 5 : 10;
  const passo = passoBase * potencia;
  return { teto: Math.ceil(maximo / passo) * passo, passo };
}

/** Escala com exatamente `intervalos` divisões — o eixo da direita usa o mesmo número de linhas de grade do da esquerda. */
function escalaComIntervalos(maximo: number, intervalos: number) {
  if (maximo <= 0) return { teto: intervalos, passo: 1 };
  const bruto = maximo / intervalos;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const normalizado = bruto / potencia;
  const passoBase = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 2.5 ? 2.5 : normalizado <= 5 ? 5 : 10;
  const passo = passoBase * potencia;
  return { teto: passo * intervalos, passo };
}

type Ponto = { x: number; y: number };

/** Curva monotônica (mesmo "monotone" do recharts) em cubic béziers. */
function caminhoMonotono(pontos: Ponto[]): string {
  const n = pontos.length;
  if (n === 0) return '';
  if (n === 1) return `M ${pontos[0].x},${pontos[0].y}`;

  const dx: number[] = [];
  const inclinacao: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pontos[i + 1].x - pontos[i].x);
    inclinacao.push((pontos[i + 1].y - pontos[i].y) / (pontos[i + 1].x - pontos[i].x || 1));
  }
  const tangente: number[] = [inclinacao[0]];
  for (let i = 1; i < n - 1; i++) {
    tangente.push(inclinacao[i - 1] * inclinacao[i] <= 0 ? 0 : (inclinacao[i - 1] + inclinacao[i]) / 2);
  }
  tangente.push(inclinacao[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (inclinacao[i] === 0) {
      tangente[i] = 0;
      tangente[i + 1] = 0;
      continue;
    }
    const a = tangente[i] / inclinacao[i];
    const b = tangente[i + 1] / inclinacao[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      tangente[i] = (3 * a * inclinacao[i]) / h;
      tangente[i + 1] = (3 * b * inclinacao[i]) / h;
    }
  }

  let caminho = `M ${pontos[0].x},${pontos[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const passoX = dx[i] / 3;
    caminho += ` C ${pontos[i].x + passoX},${pontos[i].y + tangente[i] * passoX} ${pontos[i + 1].x - passoX},${pontos[i + 1].y - tangente[i + 1] * passoX} ${pontos[i + 1].x},${pontos[i + 1].y}`;
  }
  return caminho;
}

const estilos = StyleSheet.create({
  container: { marginBottom: 14, borderWidth: 1, borderColor: '#e1e0d9', borderRadius: 4, padding: 10 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo: { fontSize: 10, fontWeight: 700 },
  descricao: { fontSize: 7, color: '#898781', marginTop: 2 },
  icones: { flexDirection: 'row' },
  icone: { marginLeft: 3 },
  legenda: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  legendaPonto: { width: 6, height: 6, borderRadius: 3, marginRight: 3 },
  legendaTexto: { fontSize: 7, color: '#52514e' },
  vazio: { height: ALTURA, alignItems: 'center', justifyContent: 'center' },
  vazioTexto: { fontSize: 8, color: '#898781' },
});

// Gráfico de área desenhado à mão com as primitivas SVG do @react-pdf/renderer (Recharts não roda no
// PDF). Reproduz o do dashboard: eixo Y com grade, datas no eixo X, curva suave, legenda e o valor de
// cada série sobre a linha nas datas que aparecem no eixo.
export function PdfAreaChart({ titulo, descricao, dados, series, formatarData, plataformas }: PdfAreaChartProps) {
  const cabecalho = (
    <View style={estilos.cabecalho}>
      <View>
        <Text style={estilos.titulo}>{titulo}</Text>
        {descricao && <Text style={estilos.descricao}>{descricao}</Text>}
      </View>
      {plataformas && plataformas.length > 0 && (
        <View style={estilos.icones}>
          {plataformas.map((plataforma) => (
            <View key={plataforma} style={estilos.icone}>
              <PlatformIconPdf plataforma={plataforma} size={10} />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (dados.length === 0) {
    return (
      <View style={estilos.container} wrap={false}>
        {cabecalho}
        <View style={estilos.vazio}>
          <Text style={estilos.vazioTexto}>Sem dados neste período — tente ampliar o intervalo</Text>
        </View>
      </View>
    );
  }

  const valorDe = (ponto: Record<string, unknown>, chave: string) => (typeof ponto[chave] === 'number' ? (ponto[chave] as number) : null);
  const maximoDoEixo = (eixo: 'esquerda' | 'direita') =>
    Math.max(0, ...dados.flatMap((ponto) => series.filter((serie) => (serie.eixo ?? 'esquerda') === eixo).map((serie) => valorDe(ponto, serie.chave) ?? 0)));
  const temEixoDireito = series.some((serie) => serie.eixo === 'direita');
  const escalaEsquerda = escalaY(maximoDoEixo('esquerda'));
  const intervalos = Math.max(1, Math.round(escalaEsquerda.teto / escalaEsquerda.passo));
  const escalaDireita = escalaComIntervalos(maximoDoEixo('direita'), intervalos);
  const { teto, passo: passoY } = escalaEsquerda;
  const margemDireita = temEixoDireito ? MARGEM_DIREITA_COM_EIXO : MARGEM.direita;
  const larguraUtil = LARGURA - MARGEM.esquerda - margemDireita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base;
  const linhaBase = MARGEM.topo + alturaUtil;
  const passo = passoDoEixo(dados.length);
  const ultimo = dados.length - 1;

  const xDe = (indice: number) => MARGEM.esquerda + (dados.length > 1 ? (indice / ultimo) * larguraUtil : larguraUtil / 2);
  const yDe = (valor: number) => linhaBase - (valor / teto) * alturaUtil;
  const yDaSerie = (serie: SeriePdf, valor: number) => linhaBase - (valor / (serie.eixo === 'direita' ? escalaDireita.teto : teto)) * alturaUtil;

  const linhasDeGrade = Array.from({ length: Math.round(teto / passoY) + 1 }, (_, i) => i * passoY);
  const indicesDoEixo = dados.map((_, indice) => indice).filter((indice) => indice % passo === 0);
  const ancora = (indice: number): 'start' | 'middle' | 'end' => (indice === 0 ? 'start' : indice > ultimo - passo / 2 ? 'end' : 'middle');

  return (
    <View style={estilos.container} wrap={false}>
      {cabecalho}
      <View style={estilos.legenda}>
        {series.map((serie) => (
          <View key={serie.chave} style={estilos.legendaItem}>
            <View style={[estilos.legendaPonto, { backgroundColor: serie.cor }]} />
            <Text style={estilos.legendaTexto}>{serie.rotulo}</Text>
          </View>
        ))}
      </View>
      <Svg width={LARGURA} height={ALTURA} viewBox={`0 0 ${LARGURA} ${ALTURA}`}>
        {linhasDeGrade.map((valor) => (
          <Line key={valor} x1={MARGEM.esquerda} y1={yDe(valor)} x2={LARGURA - margemDireita} y2={yDe(valor)} stroke="#e1e0d9" strokeWidth={0.6} />
        ))}
        {linhasDeGrade.map((valor) => (
          <Text key={`y${valor}`} x={MARGEM.esquerda - 5} y={yDe(valor) + 2} {...fonte(6)} fill="#898781" textAnchor="end">
            {Number.isInteger(valor) ? String(valor) : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </Text>
        ))}

        {temEixoDireito &&
          linhasDeGrade.map((_, i) => (
            <Text key={`yd${i}`} x={LARGURA - margemDireita + 5} y={yDe(i * passoY) + 2} {...fonte(6)} fill="#898781" textAnchor="start">
              {(i * escalaDireita.passo).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </Text>
          ))}

        {series.map((serie) => {
          const pontos = dados.flatMap((ponto, indice): Ponto[] => {
            const valor = valorDe(ponto, serie.chave);
            return valor === null ? [] : [{ x: xDe(indice), y: yDaSerie(serie, valor) }];
          });
          if (pontos.length === 0) return null;
          const linha = caminhoMonotono(pontos);
          const area = `${linha} L ${pontos[pontos.length - 1].x},${linhaBase} L ${pontos[0].x},${linhaBase} Z`;
          return (
            <G key={serie.chave}>
              <Path d={area} fill={serie.cor} fillOpacity={0.12} />
              <Path d={linha} fill="none" stroke={serie.cor} strokeWidth={1.4} />
            </G>
          );
        })}

        {series.flatMap((serie) =>
          indicesDoEixo.flatMap((indice) => {
            const valor = valorDe(dados[indice], serie.chave);
            if (valor === null) return [];
            return [
              <Text
                key={`${serie.chave}-${indice}`}
                x={xDe(indice)}
                y={yDaSerie(serie, valor) - 4}
                {...fonte(6, 700)}
                fill="#0b0b0b"
                textAnchor={ancora(indice)}
              >
                {serie.formatarValor(valor)}
              </Text>,
            ];
          })
        )}

        {indicesDoEixo.map((indice) => (
          <Text key={`x${indice}`} x={xDe(indice)} y={ALTURA - 6} {...fonte(6)} fill="#898781" textAnchor={ancora(indice)}>
            {formatarData(dados[indice].date)}
          </Text>
        ))}
      </Svg>
    </View>
  );
}
