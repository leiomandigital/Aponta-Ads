import { createRequire } from 'node:module';
import { Document, Page, Text, View, Image, StyleSheet, Font, Svg, Polyline } from '@react-pdf/renderer';
// Imports relativos (não @/) — este arquivo é alcançado pelo bundler
// serverless da Vercel a partir de api/export/pdf.ts, que não garante
// resolver o alias de path do tsconfig usado pelo Vite no client.
import { resolverSecoesGeral, type SecaoGeral } from '../../../constants/dashboard.constants.js';
import type { IntegrationKey, LeadsDiario } from '../../../types/database.types.js';
import { extrairPathDaUrl, formatarData, formatarDataHora, formatarMoeda, formatarNumero, formatarPercentual } from '../../../utils/formatters.js';
import { sequenciaDoCaminho, type ComparacaoPeriodo, type DistribuicaoDeLeads, type JornadaDoLead } from '../../../utils/metricsAggregation.js';
import {
  calcularCustoPorConversao,
  calcularLeadsECpl,
  calcularPainelDeAnalytics,
  type PainelDeMidia,
  type PontoCustoPorConversao,
  type PontoSessoesELeads,
  type PontoCustoPorLead,
} from '../../../utils/painelCalculos.js';
import { PdfAreaChart, type SeriePdf } from './PdfAreaChart.js';
import { PlatformIconPdf } from './PlatformIconPdf.js';

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

// Mesmas cores de tendência do KpiCard do app (emerald-600/destructive).
const COR_POSITIVO = '#059669';
const COR_NEGATIVO = '#dc2626';
const COR_NEUTRO = '#898781';

// Altura reservada no topo de cada página pro cabeçalho fixo (logo + título)
// não sobrepor o conteúdo — ver estilos.cabecalho, que é `fixed` e posicionado
// em absolute, logo não empurra o fluxo normal sozinho.
const ALTURA_CABECALHO = 108;

const estilos = StyleSheet.create({
  // fontFeatureSettings desliga ligaturas (liga/rlig/calt) — sem isso, o
  // Montserrat embutido troca "fi"/"fl" por um glifo de ligadura que o
  // @react-pdf/renderer às vezes perde ao quebrar linha, sumindo com a letra
  // "i" bem no meio da palavra (bug real, reproduzido e confirmado aqui).
  page: {
    paddingTop: ALTURA_CABECALHO,
    paddingBottom: 48,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: 'Montserrat',
    color: '#0b0b0b',
    fontFeatureSettings: { liga: false, rlig: false, calt: false, dlig: false, hlig: false },
  },
  // fixed + position absolute: repete idêntico em toda página (ver guia do
  // react-pdf pra cabeçalho/rodapé) — não participa do fluxo normal, por isso
  // o conteúdo abaixo depende do paddingTop da página pra não ficar por baixo.
  cabecalho: {
    position: 'absolute',
    top: 24,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    // flex-end (não center): título/subtítulo e logo ficam ancorados pela
    // base, então a linha abaixo (borderBottom) sempre fecha por baixo dos
    // dois — mesmo com a logo maior que o bloco de texto.
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: COR_MARCA,
    paddingBottom: 10,
  },
  logo: { width: 56, height: 56, objectFit: 'contain' },
  titulo: { fontSize: 16, fontWeight: 800, color: COR_MARCA },
  subtitulo: { fontSize: 9, color: '#52514e', marginTop: 4 },
  secao: { marginBottom: 20 },
  secaoTitulo: { fontSize: 12, fontWeight: 700, marginBottom: 8, color: COR_MARCA },
  grid: { flexDirection: 'row' },
  card: { border: '1pt solid #e1e0d9', borderRadius: 4, padding: 8, marginBottom: 8 },
  cardCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardIcones: { flexDirection: 'row' },
  cardIcone: { marginLeft: 3 },
  cardLabel: { fontSize: 8, color: '#52514e' },
  cardValor: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  cardComparacao: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  cardComparacaoTexto: { fontSize: 7, marginLeft: 3 },
  graficos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 4 },
  tabelaTitulo: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 6 },
  tituloComIcones: { flexDirection: 'row', alignItems: 'center' },
  tituloIcone: { marginLeft: 4 },
  linhaTabela: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e1e0d9', paddingVertical: 4 },
  celulaCabecalho: { fontSize: 7, fontWeight: 700, color: '#52514e', paddingRight: 4 },
  celula: { fontSize: 7.5, paddingRight: 4 },
  celulaVazia: { flex: 1, fontSize: 9, color: '#898781', textAlign: 'center', paddingVertical: 4 },
  rodape: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#898781',
  },
});

interface ComparacaoCardPdf extends ComparacaoPeriodo {
  formatarDelta: (valor: number) => string;
  /** Se um valor MAIOR é bom para essa métrica (padrão 'up' — ex.: Custo deve usar 'down'). */
  direcaoBoa?: 'up' | 'down';
}

interface KpiCardPdfProps {
  rotulo: string;
  valor: string;
  comparacao?: ComparacaoCardPdf;
  /** Integração(ões) de onde vem esse dado, exibida(s) como logo no canto do card — igual ao KpiCard do app. */
  plataformas?: IntegrationKey[];
  /** Quantos cards cabem na linha (3 ou 4) — define a largura, igual à grade do dashboard. */
  colunas?: 3 | 4;
  /** Último da linha não leva margem à direita. */
  ultimo?: boolean;
}

// Mesmo desenho do ícone TrendingUp/TrendingDown do lucide-react (usado no
// KpiCard do app) — não dá pra importar o componente lucide direto porque ele
// gera <svg>/<polyline> do react-dom, que o react-pdf não renderiza; os
// pontos das polylines abaixo são os mesmos do pacote (ver
// node_modules/lucide-react/dist/esm/icons/trending-{up,down}.js).
function IconeTendenciaPdf({ subiu, cor }: { subiu: boolean; cor: string }) {
  const pontos = subiu
    ? { seta: '22 7 13.5 15.5 8.5 10.5 2 17', rabo: '16 7 22 7 22 13' }
    : { seta: '22 17 13.5 8.5 8.5 13.5 2 7', rabo: '16 17 22 17 22 11' };

  return (
    <Svg viewBox="0 0 24 24" style={{ width: 8, height: 8 }}>
      <Polyline points={pontos.seta} stroke={cor} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points={pontos.rabo} stroke={cor} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function KpiCardPdf({ rotulo, valor, comparacao, plataformas, colunas = 3, ultimo = false }: KpiCardPdfProps) {
  const semVariacao = comparacao && comparacao.delta === 0 && comparacao.percentual === null;
  const mostrarComparacao = comparacao && !semVariacao;

  let textoComparacao = '';
  let corComparacao = COR_NEUTRO;
  let subiu = false;
  if (mostrarComparacao && comparacao) {
    subiu = comparacao.delta > 0;
    const direcaoBoa = comparacao.direcaoBoa ?? 'up';
    const ehPositivo = comparacao.delta === 0 ? null : subiu === (direcaoBoa === 'up');
    corComparacao = ehPositivo === null ? COR_NEUTRO : ehPositivo ? COR_POSITIVO : COR_NEGATIVO;
    const percentualTexto = comparacao.percentual !== null ? formatarPercentual(Math.abs(comparacao.percentual)) : 'novo';
    const deltaTexto = `${comparacao.delta >= 0 ? '+' : ''}${comparacao.formatarDelta(comparacao.delta)}`;
    textoComparacao = `${percentualTexto} (${deltaTexto} vs. período anterior)`;
  }

  return (
    <View style={[estilos.card, { width: colunas === 4 ? '23.5%' : '31.6%', marginRight: ultimo ? 0 : '2.1%' }]}>
      <View style={estilos.cardCabecalho}>
        <Text style={estilos.cardLabel}>{rotulo}</Text>
        {plataformas && plataformas.length > 0 && (
          <View style={estilos.cardIcones}>
            {plataformas.map((plataforma) => (
              <View key={plataforma} style={estilos.cardIcone}>
                <PlatformIconPdf plataforma={plataforma} size={9} />
              </View>
            ))}
          </View>
        )}
      </View>
      <Text style={estilos.cardValor}>{valor}</Text>
      {mostrarComparacao && (
        <View style={estilos.cardComparacao}>
          <IconeTendenciaPdf subiu={subiu} cor={corComparacao} />
          <Text style={[estilos.cardComparacaoTexto, { color: corComparacao }]}>{textoComparacao}</Text>
        </View>
      )}
    </View>
  );
}

interface ColunaTabela {
  rotulo: string;
  /** Peso da coluna na largura da tabela (padrão 1). */
  flex?: number;
}

// Título + linha de cabeçalho presos num bloco só (wrap={false}): sem isso, o
// título de uma tabela pode acabar sozinho no fim de uma página, com as
// linhas de dado (ou até o cabeçalho de coluna) começando só na próxima.
function TituloSecaoPdf({ titulo, plataformas, estilo = estilos.secaoTitulo }: { titulo: string; plataformas?: IntegrationKey[]; estilo?: Record<string, string | number> }) {
  return (
    <View style={estilos.tituloComIcones}>
      <Text style={estilo}>{titulo}</Text>
      {plataformas?.map((plataforma) => (
        <View key={plataforma} style={estilos.tituloIcone}>
          <PlatformIconPdf plataforma={plataforma} size={9} />
        </View>
      ))}
    </View>
  );
}

function CabecalhoTabela({ titulo, colunas, plataformas }: { titulo: string; colunas: ColunaTabela[]; plataformas?: IntegrationKey[] }) {
  return (
    <View wrap={false}>
      <TituloSecaoPdf titulo={titulo} plataformas={plataformas} estilo={estilos.tabelaTitulo} />
      <View style={estilos.linhaTabela}>
        {colunas.map((coluna) => (
          <Text key={coluna.rotulo} style={[estilos.celulaCabecalho, { flex: coluna.flex ?? 1 }]}>
            {coluna.rotulo}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Linhas em fluxo normal (podem quebrar entre páginas livremente) — cada
// linha individual não quebra sozinha (wrap={false}) pra nunca partir uma
// célula ao meio entre duas páginas.
function LinhasTabela({ linhas, flex = [] }: { linhas: string[][]; flex?: number[] }) {
  if (linhas.length === 0) {
    return (
      <View style={estilos.linhaTabela}>
        <Text style={estilos.celulaVazia}>Sem dados neste período — tente ampliar o intervalo</Text>
      </View>
    );
  }

  return (
    <>
      {linhas.map((linha, indiceLinha) => (
        <View style={estilos.linhaTabela} key={indiceLinha} wrap={false}>
          {linha.map((valor, indiceColuna) => (
            <Text key={indiceColuna} style={[estilos.celula, { flex: flex[indiceColuna] ?? 1 }]}>
              {valor}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}

const ROTULO_PLATAFORMA_PDF: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads' };

type PainelAnalytics = ReturnType<typeof calcularPainelDeAnalytics>;

interface ReportDocumentProps {
  aba: string;
  conta: string;
  dataInicio: string;
  dataFim: string;
  nomeDoSistema?: string | null;
  logoUrl?: string | null;
  /** Mídia paga (Google Ads / Meta Ads) já calculada com as mesmas funções do dashboard (painelCalculos). */
  painelMidia?: PainelDeMidia;
  painelAnalytics?: PainelAnalytics;
  custoPorLead?: LeadsDiario[];
  custoPorLeadAnterior?: LeadsDiario[];
  serieCustoPorLead?: PontoCustoPorLead[];
  serieCustoPorConversao?: PontoCustoPorConversao[];
  serieSessoesELeads?: PontoSessoesELeads[];
  jornadaDoLead?: JornadaDoLead;
  distribuicaoLeads?: DistribuicaoDeLeads;
  linksFormularios?: Record<string, string>;
}

const SEM_DADOS = '—';

// Sessões (GA4) e leads (RD Station) em gráficos separados — igual ao dashboard.
const SERIES_SESSOES: SeriePdf[] = [{ chave: 'sessions', rotulo: 'Sessões', cor: COR_SERIE_1, formatarValor: formatarNumero }];
const SERIES_LEADS: SeriePdf[] = [{ chave: 'leads', rotulo: 'Leads', cor: COR_SERIE_2, formatarValor: formatarNumero }];
const SERIES_CUSTO_POR_LEAD: SeriePdf[] = [{ chave: 'cost_per_lead', rotulo: 'Custo por lead', cor: COR_SERIE_1, formatarValor: formatarMoeda }];
// Conversões por dia (barras) e custo por conversão (linha) em gráficos separados — igual ao dashboard Google Ads / Meta Ads.
const SERIES_CONVERSOES: SeriePdf[] = [{ chave: 'conversions', rotulo: 'Conversões por dia', cor: COR_SERIE_2, formatarValor: formatarNumero }];
const SERIES_CUSTO_POR_CONVERSAO: SeriePdf[] = [
  { chave: 'cost_per_conversion', rotulo: 'Custo por conversão', cor: COR_SERIE_1, formatarValor: formatarMoeda },
];
const DESCRICAO_GRAFICO = 'Tendência no período selecionado';

function cardComparacao(comparacao: ComparacaoPeriodo | null | undefined, formatarDelta: (valor: number) => string, direcaoBoa: 'up' | 'down') {
  return comparacao ? { ...comparacao, formatarDelta, direcaoBoa } : undefined;
}

export function ReportDocument({
  aba,
  conta,
  dataInicio,
  dataFim,
  nomeDoSistema,
  logoUrl,
  painelMidia,
  painelAnalytics,
  custoPorLead = [],
  custoPorLeadAnterior,
  serieCustoPorLead = [],
  serieCustoPorConversao = [],
  serieSessoesELeads = [],
  jornadaDoLead,
  distribuicaoLeads,
  linksFormularios = {},
}: ReportDocumentProps) {
  const nome = nomeDoSistema?.trim() || 'ApontaAds';
  const tituloAba = ROTULO_ABA[aba] ?? aba;
  // Mesma lista de seções (e mesma ordem) do dashboard Geral — ver resolverSecoesGeral.
  const secoesGeral = aba === 'geral' ? resolverSecoesGeral() : [];
  const jornada = jornadaDoLead;

  const cardsMidiaGeral = () => {
    if (!painelMidia) return null;
    const { metricasMidia: m, comparacaoMidia: c, temDadosMidia, detalhamentoCusto, comparacaoCustoDetalhado } = painelMidia;
    const v = (formatado: string) => (temDadosMidia ? formatado : SEM_DADOS);
    const midia: IntegrationKey[] = ['google_ads', 'meta_ads'];
    const { temLeads, leads, comparacaoLeads, cpl, comparacaoCpl } = calcularLeadsECpl({
      custoPorLead,
      custoPorLeadAnterior,
      detalhamentoCusto,
      comparacaoCustoDetalhado,
    });

    return (
      <View wrap={false}>
        <View style={estilos.grid}>
          <KpiCardPdf colunas={4} rotulo="Impressões" valor={v(formatarNumero(m.impressions))} comparacao={cardComparacao(c.impressions, formatarNumero, 'up')} plataformas={midia} />
          <KpiCardPdf colunas={4} rotulo="Cliques" valor={v(formatarNumero(m.clicks))} comparacao={cardComparacao(c.clicks, formatarNumero, 'up')} plataformas={midia} />
          <KpiCardPdf colunas={4} rotulo="Leads" valor={temLeads ? formatarNumero(leads) : SEM_DADOS} comparacao={cardComparacao(comparacaoLeads, formatarNumero, 'up')} plataformas={['rd_station']} />
          <KpiCardPdf
            colunas={4}
            ultimo
            rotulo="Custo total"
            valor={v(formatarMoeda(detalhamentoCusto.costTotal))}
            comparacao={cardComparacao(comparacaoCustoDetalhado.costTotal, formatarMoeda, 'down')}
            plataformas={midia}
          />
        </View>
        <View style={estilos.grid}>
          <KpiCardPdf colunas={4} rotulo="CPM" valor={formatarMoeda(m.cpm)} comparacao={cardComparacao(c.cpm, formatarMoeda, 'down')} plataformas={midia} />
          <KpiCardPdf colunas={4} rotulo="CPC" valor={formatarMoeda(m.cpc)} comparacao={cardComparacao(c.cpc, formatarMoeda, 'down')} plataformas={midia} />
          <KpiCardPdf colunas={4} rotulo="CPL" valor={cpl !== null ? formatarMoeda(cpl) : SEM_DADOS} comparacao={cardComparacao(comparacaoCpl, formatarMoeda, 'down')} plataformas={['rd_station']} />
          <KpiCardPdf colunas={4} ultimo rotulo="CTR" valor={formatarPercentual(m.ctr)} comparacao={cardComparacao(c.ctr, formatarPercentual, 'up')} plataformas={midia} />
        </View>
      </View>
    );
  };

  const cardsAnalytics = () => {
    if (!painelAnalytics) return null;
    const { metricasAnalytics: m, comparacaoAnalytics: c } = painelAnalytics;
    const v = (formatado: string) => (m.temDados ? formatado : SEM_DADOS);
    return (
      <View style={estilos.grid} wrap={false}>
        <KpiCardPdf colunas={4} rotulo="Sessões" valor={v(formatarNumero(m.sessions))} comparacao={cardComparacao(c.sessions, formatarNumero, 'up')} plataformas={['ga4']} />
        <KpiCardPdf colunas={4} rotulo="Usuários" valor={v(formatarNumero(m.users))} comparacao={cardComparacao(c.users, formatarNumero, 'up')} plataformas={['ga4']} />
      </View>
    );
  };

  /** Cards dos dashboards Google Ads / Meta Ads — mesmas linhas (3 | 3 ou 4 | 3) do dashboard. */
  const cardsPlataforma = () => {
    if (!painelMidia) return null;
    const { metricasMidia: m, comparacaoMidia: c, temDadosMidia, detalhamentoCusto, comparacaoCustoDetalhado } = painelMidia;
    const v = (formatado: string) => (temDadosMidia ? formatado : SEM_DADOS);
    const plataformas: IntegrationKey[] = [aba as IntegrationKey];
    const comTaxas = aba === 'meta_ads';
    const { cpa, comparacao: comparacaoCpa } = calcularCustoPorConversao({
      conversoes: m.conversions,
      detalhamentoCusto,
      comparacaoConversoes: c.conversions,
      comparacaoCustoDetalhado,
    });
    const colunasCustos = comTaxas ? 4 : 3;

    return (
      <View wrap={false}>
        <View style={estilos.grid}>
          <KpiCardPdf rotulo="Impressões" valor={v(formatarNumero(m.impressions))} comparacao={cardComparacao(c.impressions, formatarNumero, 'up')} plataformas={plataformas} />
          <KpiCardPdf rotulo="Cliques" valor={v(formatarNumero(m.clicks))} comparacao={cardComparacao(c.clicks, formatarNumero, 'up')} plataformas={plataformas} />
          <KpiCardPdf ultimo rotulo="Conversões" valor={v(formatarNumero(m.conversions))} comparacao={cardComparacao(c.conversions, formatarNumero, 'up')} plataformas={plataformas} />
        </View>
        <View style={estilos.grid}>
          <KpiCardPdf colunas={colunasCustos} rotulo="Custo/conversão" valor={cpa !== null ? formatarMoeda(cpa) : SEM_DADOS} comparacao={cardComparacao(comparacaoCpa, formatarMoeda, 'down')} plataformas={plataformas} />
          <KpiCardPdf colunas={colunasCustos} rotulo="Custo de mídia" valor={v(formatarMoeda(m.cost))} comparacao={cardComparacao(c.cost, formatarMoeda, 'down')} plataformas={plataformas} />
          {comTaxas && (
            <KpiCardPdf
              colunas={4}
              rotulo="Custo com taxas"
              valor={v(formatarMoeda(detalhamentoCusto.costComTaxas))}
              comparacao={cardComparacao(comparacaoCustoDetalhado.costComTaxas, formatarMoeda, 'down')}
              plataformas={plataformas}
            />
          )}
          <KpiCardPdf
            colunas={colunasCustos}
            ultimo
            rotulo="Custo total"
            valor={v(formatarMoeda(detalhamentoCusto.costTotal))}
            comparacao={cardComparacao(comparacaoCustoDetalhado.costTotal, formatarMoeda, 'down')}
            plataformas={plataformas}
          />
        </View>
        <View style={estilos.grid}>
          <KpiCardPdf rotulo="CPM" valor={formatarMoeda(m.cpm)} comparacao={cardComparacao(c.cpm, formatarMoeda, 'down')} plataformas={plataformas} />
          <KpiCardPdf rotulo="CPC" valor={formatarMoeda(m.cpc)} comparacao={cardComparacao(c.cpc, formatarMoeda, 'down')} plataformas={plataformas} />
          <KpiCardPdf ultimo rotulo="CTR" valor={formatarPercentual(m.ctr)} comparacao={cardComparacao(c.ctr, formatarPercentual, 'up')} plataformas={plataformas} />
        </View>
      </View>
    );
  };

  const tabelaDeCampanhas = () => {
    const campanhas = painelMidia?.campanhas ?? [];
    const meta = aba === 'meta_ads';
    // Mais largura nas colunas de valor em reais (R$ 7.051,79) quando a tabela tem a coluna extra do Meta.
    const dinheiro = meta ? 1.5 : 1.25;
    const colunas: ColunaTabela[] = [
      { rotulo: 'Campanha', flex: meta ? 2.2 : 2.8 },
      { rotulo: meta ? 'Custo de mídia' : 'Custo', flex: dinheiro },
      ...(meta ? [{ rotulo: 'Custo com taxa', flex: dinheiro }] : []),
      { rotulo: 'Custo total', flex: dinheiro },
      { rotulo: 'Impressões', flex: 1.2 },
      { rotulo: 'Cliques', flex: 0.9 },
      { rotulo: 'Conversões', flex: 1 },
      { rotulo: 'CPM', flex: 1.1 },
      { rotulo: 'CPC', flex: 1 },
      { rotulo: 'CTR', flex: 0.9 },
      { rotulo: 'Custo/conversão', flex: 1.3 },
    ];
    return (
      <View style={estilos.secao}>
        <CabecalhoTabela titulo="Campanhas" colunas={colunas} />
        <LinhasTabela
          flex={colunas.map((coluna) => coluna.flex ?? 1)}
          linhas={campanhas.map((campanha) => [
            campanha.campaign_name ?? campanha.campaign_id,
            formatarMoeda(campanha.cost),
            ...(meta ? [formatarMoeda(campanha.costComTaxas)] : []),
            formatarMoeda(campanha.costTotal),
            formatarNumero(campanha.impressions),
            formatarNumero(campanha.clicks),
            formatarNumero(campanha.conversions),
            formatarMoeda(campanha.cpm),
            formatarMoeda(campanha.cpc),
            formatarPercentual(campanha.ctr),
            formatarMoeda(campanha.conversions > 0 ? campanha.costTotal / campanha.conversions : null),
          ])}
        />
      </View>
    );
  };

  const renderizarSecaoGeral = (secao: SecaoGeral) => {
    switch (secao) {
      case 'cards_midia':
        return <View key={secao}>{cardsMidiaGeral()}</View>;
      case 'cards_analytics':
        return <View key={secao}>{cardsAnalytics()}</View>;
      case 'graficos':
        return (
          <View key={secao}>
            <PdfAreaChart
              titulo="Sessões"
              descricao={DESCRICAO_GRAFICO}
              dados={serieSessoesELeads}
              series={SERIES_SESSOES}
              formatarData={formatarData}
              plataformas={['ga4']}
            />
            <PdfAreaChart
              titulo="Leads"
              descricao={DESCRICAO_GRAFICO}
              dados={serieSessoesELeads}
              series={SERIES_LEADS}
              tipo="barras"
              formatarData={formatarData}
              plataformas={['rd_station']}
            />
            <PdfAreaChart
              titulo="Custo por lead"
              descricao={DESCRICAO_GRAFICO}
              dados={serieCustoPorLead}
              series={SERIES_CUSTO_POR_LEAD}
              formatarData={formatarData}
              plataformas={['rd_station']}
            />
          </View>
        );
      case 'caminhos':
        return (
          <View key={secao} style={estilos.secao}>
            <CabecalhoTabela
              titulo="Caminhos até o lead"
              colunas={[{ rotulo: 'Caminho (na ordem da visita, até o cadastro)', flex: 6 }, { rotulo: 'Leads', flex: 0.7 }]}
              plataformas={['ga4']}
            />
            <LinhasTabela
              flex={[6, 0.7]}
              linhas={(jornada?.caminhos ?? []).map((caminho) => [`${sequenciaDoCaminho(caminho).join('  →  ')}  →  cadastro`, formatarNumero(caminho.leads)])}
            />
          </View>
        );
      case 'leads_por_formulario':
        return (
          <View key={secao} style={estilos.secao}>
            <CabecalhoTabela
              titulo="Leads por formulário"
              colunas={[{ rotulo: 'Formulário', flex: 2 }, { rotulo: 'Link', flex: 2 }, { rotulo: 'Leads', flex: 0.7 }]}
              plataformas={['rd_station']}
            />
            <LinhasTabela
              flex={[2, 2, 0.7]}
              linhas={(distribuicaoLeads?.porFormulario ?? []).map((item) => [
                item.rotulo || '(sem formulário)',
                linksFormularios[item.rotulo] ? extrairPathDaUrl(linksFormularios[item.rotulo]) : SEM_DADOS,
                formatarNumero(item.total),
              ])}
            />
          </View>
        );
      case 'origem_midia':
        return (
          <View key={secao} style={estilos.secao}>
            <CabecalhoTabela titulo="Origem/mídia" colunas={[{ rotulo: 'Origem/mídia', flex: 3 }, { rotulo: 'Cadastro', flex: 1 }]} plataformas={['ga4']} />
            <LinhasTabela flex={[3, 1]} linhas={(jornada?.origens ?? []).map((item) => [item.rotulo, formatarNumero(item.total)])} />
          </View>
        );
      case 'comparativo_plataformas':
        return (
          <View key={secao} style={estilos.secao}>
            <CabecalhoTabela
              titulo="Comparativo de plataformas"
              colunas={[
                { rotulo: 'Plataforma', flex: 1.2 },
                { rotulo: 'Custo' },
                { rotulo: 'Impressões' },
                { rotulo: 'Cliques' },
                { rotulo: 'Conversões' },
                { rotulo: 'CPM' },
                { rotulo: 'CPC' },
                { rotulo: 'CTR' },
                { rotulo: 'Custo/conversão', flex: 1.3 },
              ]}
              plataformas={['google_ads', 'meta_ads']}
            />
            <LinhasTabela
              flex={[1.2, 1, 1, 1, 1, 1, 1, 1, 1.3]}
              linhas={(painelMidia?.comparativoPlataformas ?? []).map((linha) => [
                ROTULO_PLATAFORMA_PDF[linha.platform] ?? linha.platform,
                formatarMoeda(linha.cost),
                formatarNumero(linha.impressions),
                formatarNumero(linha.clicks),
                formatarNumero(linha.conversions),
                formatarMoeda(linha.cpm),
                formatarMoeda(linha.cpc),
                formatarPercentual(linha.ctr),
                formatarMoeda(linha.cpa),
              ])}
            />
          </View>
        );
      case 'dispositivos':
        return (
          <View key={secao} style={estilos.secao}>
            <CabecalhoTabela
              titulo="Sessões por dispositivo"
              colunas={[{ rotulo: 'Dispositivo', flex: 2 }, { rotulo: 'Sessões' }, { rotulo: 'Usuários' }, { rotulo: 'Leads' }]}
              plataformas={['ga4']}
            />
            <LinhasTabela
              flex={[2, 1, 1, 1]}
              linhas={(painelAnalytics?.dispositivos ?? []).map((item) => [item.device, formatarNumero(item.sessions), formatarNumero(item.users), formatarNumero(item.leads)])}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Document>
      <Page size="A4" style={estilos.page}>
        <View style={estilos.cabecalho} fixed>
          <View>
            <Text style={estilos.titulo}>{nome}</Text>
            <Text style={estilos.subtitulo}>
              {tituloAba} · {conta} · {formatarData(dataInicio)} a {formatarData(dataFim)}
            </Text>
          </View>
          {logoUrl && <Image src={logoUrl} style={estilos.logo} />}
        </View>

        {aba === 'geral' && secoesGeral.map(renderizarSecaoGeral)}

        {aba !== 'geral' && painelMidia && (
          <View>
            {cardsPlataforma()}
            <PdfAreaChart
              titulo="Conversões por dia"
              descricao={DESCRICAO_GRAFICO}
              dados={serieCustoPorConversao}
              series={SERIES_CONVERSOES}
              tipo="barras"
              formatarData={formatarData}
            />
            <PdfAreaChart
              titulo="Custo por conversão"
              descricao={DESCRICAO_GRAFICO}
              dados={serieCustoPorConversao}
              series={SERIES_CUSTO_POR_CONVERSAO}
              formatarData={formatarData}
            />
            {tabelaDeCampanhas()}
          </View>
        )}

        <View style={estilos.rodape} fixed>
          <Text>
            Gerado por {nome} em {formatarDataHora(new Date())}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
