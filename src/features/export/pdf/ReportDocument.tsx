import { createRequire } from 'node:module';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
// Imports relativos (não @/) — este arquivo é alcançado pelo bundler
// serverless da Vercel a partir de api/export/pdf.ts, que não garante
// resolver o alias de path do tsconfig usado pelo Vite no client.
import type { AggregatedMetrics, LeadCostDaily } from '../../../types/database.types.js';
import { formatarData, formatarDataHora, formatarMoeda, formatarNumero, formatarPercentual } from '../../../utils/formatters.js';
import { PdfLineChart } from './PdfLineChart.js';

// @react-pdf/renderer não lê fontes via <link> do navegador — precisa de um
// arquivo local. @fontsource/montserrat empacota o .woff oficial no
// node_modules, então funciona igual em dev e na function serverless da
// Vercel, sem depender de rede em tempo de execução.
const requireLocal = createRequire(import.meta.url);
const caminhoFonte = (peso: '400' | '700' | '800') =>
  requireLocal.resolve(`@fontsource/montserrat/files/montserrat-latin-${peso}-normal.woff`);

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: caminhoFonte('400'), fontWeight: 400 },
    { src: caminhoFonte('700'), fontWeight: 700 },
    { src: caminhoFonte('800'), fontWeight: 800 },
  ],
});

const ROTULO_ABA: Record<string, string> = {
  geral: 'Geral',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  analytics: 'Analytics',
};

const ROTULO_REGIAO: Record<string, string> = {
  todas: 'Todas as regiões',
  ES: 'Espírito Santo',
  TO: 'Tocantins',
};

// Mesma paleta validada (dataviz skill) usada nos gráficos do app — ver
// src/index.css (--series-1/--series-2) e a leitura do palette.md. Fica
// separada da cor de marca de propósito (cor de marca não deve virar cor de
// série de dados).
const COR_SERIE_1 = '#2a78d6'; // blue
const COR_SERIE_2 = '#eb6834'; // orange

// Vinho Araçaúna — mesma cor de marca da sidebar/botões do app (ver
// src/index.css, --primary e --sidebar-background).
const COR_MARCA = '#7a1332';


const estilos = StyleSheet.create({
  // fontFeatureSettings desliga ligaturas (liga/rlig/calt) — sem isso, o
  // Montserrat embutido troca "fi"/"fl" por um glifo de ligadura que o
  // @react-pdf/renderer às vezes perde ao quebrar linha, sumindo com a letra
  // "i" bem no meio da palavra (bug real, reproduzido e confirmado aqui).
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: 'Montserrat',
    color: '#0b0b0b',
    fontFeatureSettings: { liga: false, rlig: false, calt: false, dlig: false, hlig: false },
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // flex-end (não center): título/subtítulo e logo ficam ancorados pela
    // base, então a linha abaixo (borderBottom) sempre fecha por baixo dos
    // dois — mesmo com a logo bem maior que o bloco de texto.
    alignItems: 'flex-end',
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: COR_MARCA,
    paddingBottom: 12,
  },
  logo: { width: 100, height: 100, objectFit: 'contain' },
  titulo: { fontSize: 16, fontWeight: 800, color: COR_MARCA },
  subtitulo: { fontSize: 9, color: '#52514e', marginTop: 4 },
  secao: { marginBottom: 20 },
  secaoTitulo: { fontSize: 12, fontWeight: 700, marginBottom: 2, color: COR_MARCA },
  secaoLegenda: { fontSize: 8, color: '#52514e', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { width: '31%', border: '1pt solid #e1e0d9', borderRadius: 4, padding: 8, marginRight: '2%', marginBottom: 8 },
  cardLabel: { fontSize: 8, color: '#52514e' },
  cardValor: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  graficos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 4 },
  tabelaTitulo: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 2 },
  tabelaLegenda: { fontSize: 8, color: '#52514e', marginBottom: 6 },
  linhaTabela: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e1e0d9', paddingVertical: 4 },
  celulaCabecalho: { flex: 1, fontSize: 8, fontWeight: 700, color: '#52514e' },
  celula: { flex: 1, fontSize: 9 },
  celulaVazia: { flex: 1, fontSize: 9, color: '#898781', textAlign: 'center', paddingVertical: 4 },
  rodape: { position: 'absolute', bottom: 24, left: 32, right: 32, fontSize: 8, color: '#898781', textAlign: 'center' },
});

interface KpiCardPdfProps {
  rotulo: string;
  valor: string;
}

function KpiCardPdf({ rotulo, valor }: KpiCardPdfProps) {
  return (
    <View style={estilos.card}>
      <Text style={estilos.cardLabel}>{rotulo}</Text>
      <Text style={estilos.cardValor}>{valor}</Text>
    </View>
  );
}

interface ColunaTabela {
  rotulo: string;
}

interface TabelaComEstadoVazioProps {
  titulo: string;
  legenda: string;
  colunas: ColunaTabela[];
  linhas: Array<Array<string>>;
}

// Tabela sempre visível, mesmo sem dados — mostra uma linha de estado vazio
// em vez de a seção inteira desaparecer do relatório.
function TabelaComEstadoVazio({ titulo, legenda, colunas, linhas }: TabelaComEstadoVazioProps) {
  return (
    <View>
      <Text style={estilos.tabelaTitulo}>{titulo}</Text>
      <Text style={estilos.tabelaLegenda}>{legenda}</Text>
      <View style={estilos.linhaTabela}>
        {colunas.map((coluna) => (
          <Text key={coluna.rotulo} style={estilos.celulaCabecalho}>
            {coluna.rotulo}
          </Text>
        ))}
      </View>
      {linhas.length === 0 ? (
        <View style={estilos.linhaTabela}>
          <Text style={estilos.celulaVazia}>Sem dados neste período — tente ampliar o intervalo</Text>
        </View>
      ) : (
        linhas.map((linha, indiceLinha) => (
          <View style={estilos.linhaTabela} key={indiceLinha}>
            {linha.map((valor, indiceColuna) => (
              <Text key={indiceColuna} style={estilos.celula}>
                {valor}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

interface CampanhaLinha {
  campaign_name: string | null;
  platform: string;
  cost: number;
  conversions: number;
  cpc: number | null;
}

interface PaginaLinha {
  page_path: string;
  sessions: number;
  users: number;
}

interface PontoSerieMidia {
  date: string;
  cost: number;
  conversions: number;
}

interface PontoSerieAnalytics {
  date: string;
  sessions: number;
  users: number;
}

interface ReportDocumentProps {
  aba: string;
  regiao: string;
  dataInicio: string;
  dataFim: string;
  logoUrl?: string | null;
  metricasMidia?: AggregatedMetrics | null;
  metricasAnalytics?: { sessions: number; users: number; leads: number } | null;
  serieTemporalMidia?: PontoSerieMidia[];
  serieTemporalAnalytics?: PontoSerieAnalytics[];
  custoPorLead?: LeadCostDaily[];
  campanhas?: CampanhaLinha[];
  sessoesPorPagina?: PaginaLinha[];
}

export function ReportDocument({
  aba,
  regiao,
  dataInicio,
  dataFim,
  logoUrl,
  metricasMidia,
  metricasAnalytics,
  serieTemporalMidia = [],
  serieTemporalAnalytics = [],
  custoPorLead,
  campanhas,
  sessoesPorPagina,
}: ReportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={estilos.page}>
        <View style={estilos.cabecalho}>
          <View>
            <Text style={estilos.titulo}>ApontaAds — {ROTULO_ABA[aba] ?? aba}</Text>
            <Text style={estilos.subtitulo}>
              {ROTULO_REGIAO[regiao] ?? regiao} · {formatarData(dataInicio)} a {formatarData(dataFim)}
            </Text>
          </View>
          {logoUrl && <Image src={logoUrl} style={estilos.logo} />}
        </View>

        {metricasMidia && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Mídia paga</Text>
            <Text style={estilos.secaoLegenda}>
              Dados combinados de Google Ads e Meta Ads no período. CPM, CTR e CPC são calculados sobre o total de
              impressões/cliques/custo do período — nunca a média entre os dias.
            </Text>
            <View style={estilos.grid}>
              <KpiCardPdf rotulo="Impressões" valor={formatarNumero(metricasMidia.impressions)} />
              <KpiCardPdf rotulo="Cliques" valor={formatarNumero(metricasMidia.clicks)} />
              <KpiCardPdf rotulo="Custo" valor={formatarMoeda(metricasMidia.cost)} />
              <KpiCardPdf rotulo="Conversões" valor={formatarNumero(metricasMidia.conversions)} />
              <KpiCardPdf rotulo="CPM" valor={formatarMoeda(metricasMidia.cpm)} />
              <KpiCardPdf rotulo="CTR" valor={formatarPercentual(metricasMidia.ctr)} />
              <KpiCardPdf rotulo="CPC" valor={formatarMoeda(metricasMidia.cpc)} />
            </View>
            <View style={estilos.graficos}>
              <PdfLineChart
                titulo="Custo por dia"
                dados={serieTemporalMidia.map((ponto) => ({ date: ponto.date, valor: ponto.cost }))}
                cor={COR_SERIE_1}
                formatarValor={formatarMoeda}
                formatarData={formatarData}
              />
              <PdfLineChart
                titulo="Conversões por dia"
                dados={serieTemporalMidia.map((ponto) => ({ date: ponto.date, valor: ponto.conversions }))}
                cor={COR_SERIE_2}
                formatarValor={formatarNumero}
                formatarData={formatarData}
              />
            </View>
            <TabelaComEstadoVazio
              titulo="Campanhas"
              legenda="As campanhas com maior investimento no período, com métricas agregadas."
              colunas={[
                { rotulo: 'Campanha' },
                { rotulo: 'Plataforma' },
                { rotulo: 'Custo' },
                { rotulo: 'Conversões' },
                { rotulo: 'CPC' },
              ]}
              linhas={(campanhas ?? []).map((campanha) => [
                campanha.campaign_name ?? '—',
                campanha.platform,
                formatarMoeda(campanha.cost),
                formatarNumero(campanha.conversions),
                formatarMoeda(campanha.cpc),
              ])}
            />
          </View>
        )}

        {metricasAnalytics && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Analytics</Text>
            <Text style={estilos.secaoLegenda}>
              Sessões, usuários e leads do Google Analytics 4 no período — não tem custo nem CPM/CTR/CPC, esses
              conceitos não existem para dado de sessão.
            </Text>
            <View style={estilos.grid}>
              <KpiCardPdf rotulo="Sessões" valor={formatarNumero(metricasAnalytics.sessions)} />
              <KpiCardPdf rotulo="Usuários" valor={formatarNumero(metricasAnalytics.users)} />
              <KpiCardPdf rotulo="Leads" valor={formatarNumero(metricasAnalytics.leads)} />
            </View>
            <View style={estilos.graficos}>
              <PdfLineChart
                titulo="Sessões por dia"
                dados={serieTemporalAnalytics.map((ponto) => ({ date: ponto.date, valor: ponto.sessions }))}
                cor={COR_SERIE_1}
                formatarValor={formatarNumero}
                formatarData={formatarData}
              />
              <PdfLineChart
                titulo="Usuários por dia"
                dados={serieTemporalAnalytics.map((ponto) => ({ date: ponto.date, valor: ponto.users }))}
                cor={COR_SERIE_2}
                formatarValor={formatarNumero}
                formatarData={formatarData}
              />
            </View>
            <TabelaComEstadoVazio
              titulo="Páginas mais visitadas"
              legenda="As 10 páginas com mais sessões no período."
              colunas={[{ rotulo: 'Página' }, { rotulo: 'Sessões' }, { rotulo: 'Usuários' }]}
              linhas={(sessoesPorPagina ?? []).map((pagina) => [
                pagina.page_path,
                formatarNumero(pagina.sessions),
                formatarNumero(pagina.users),
              ])}
            />
          </View>
        )}

        {custoPorLead && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Custo por lead por origem</Text>
            <Text style={estilos.secaoLegenda}>
              Quantidade de leads captados e investimento em mídia associado, por dia e por origem (Google Ads ou
              Meta Ads) — não inclui nome/e-mail de lead individual, que fica só no painel autenticado.
            </Text>
            <TabelaComEstadoVazio
              titulo="Leads por origem"
              legenda="Um lead é contado na data em que foi capturado, não na data de sincronização."
              colunas={[
                { rotulo: 'Data' },
                { rotulo: 'Origem' },
                { rotulo: 'Leads' },
                { rotulo: 'Investimento' },
                { rotulo: 'Custo/lead' },
              ]}
              linhas={custoPorLead.slice(0, 25).map((linha) => [
                formatarData(linha.date),
                linha.source ?? '—',
                formatarNumero(linha.leads_count),
                formatarMoeda(linha.total_cost),
                formatarMoeda(linha.cost_per_lead),
              ])}
            />
          </View>
        )}

        <Text style={estilos.rodape} fixed>
          Gerado por ApontaAds em {formatarDataHora(new Date())}
        </Text>
      </Page>
    </Document>
  );
}
