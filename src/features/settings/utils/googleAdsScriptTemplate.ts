/**
 * Gera o Google Ads Script que o usuário cola dentro do Google Ads. Ele roda
 * DENTRO do Google Ads (autorização nativa, sem Client ID/Developer
 * Token/refresh token) e escreve 3 abas na planilha — o ApontaAds lê essas
 * abas em vez de chamar a API do Google Ads (ver
 * src/integrations/google-ads/fetch.ts, que depende dos nomes de aba e de
 * coluna definidos aqui). Linhas do script mantidas curtas (~72 colunas) pra
 * caber no modal sem quebra nem rolagem lateral.
 */
export function buildGoogleAdsScript(spreadsheetId: string): string {
  return `/**
 * Script gerado pelo ApontaAds.
 *
 * Onde colar: Google Ads > Ferramentas e configurações >
 * Ações em massa > Scripts.
 *
 * Depois de autorizar, volte à lista de Scripts e defina a
 * Frequência como Diariamente (entre 0h e 2h). Cada execução
 * reescreve as abas Performance, Conversoes e PalavrasChave —
 * não edite essas abas manualmente.
 */

var SPREADSHEET_ID = '${spreadsheetId}';

// Dias de histórico reescritos a cada execução. Aumente
// temporariamente para um backfill maior e depois volte para 90.
var DIAS_HISTORICO = 90;

var ABAS = [
  {
    nome: 'Performance',
    origem: 'ad_group_ad',
    filtro: "campaign.status != 'REMOVED'",
    colunas: [
      ['date', 'segments.date'],
      ['customer_id', 'customer.id'],
      ['customer_name', 'customer.descriptive_name'],
      ['campaign_id', 'campaign.id'],
      ['campaign_name', 'campaign.name'],
      ['adgroup_id', 'ad_group.id'],
      ['adgroup_name', 'ad_group.name'],
      ['ad_id', 'ad_group_ad.ad.id'],
      ['ad_name', 'ad_group_ad.ad.name'],
      ['impressions', 'metrics.impressions'],
      ['clicks', 'metrics.clicks'],
      ['cost_micros', 'metrics.cost_micros'],
      ['conversions', 'metrics.conversions']
    ]
  },
  {
    nome: 'Conversoes',
    origem: 'ad_group',
    filtro: "campaign.status != 'REMOVED'",
    colunas: [
      ['date', 'segments.date'],
      ['customer_id', 'customer.id'],
      ['customer_name', 'customer.descriptive_name'],
      ['campaign_id', 'campaign.id'],
      ['campaign_name', 'campaign.name'],
      ['adgroup_id', 'ad_group.id'],
      ['adgroup_name', 'ad_group.name'],
      ['conversion_action_name', 'segments.conversion_action_name'],
      ['conversions', 'metrics.conversions'],
      ['conversions_value', 'metrics.conversions_value']
    ]
  },
  {
    nome: 'PalavrasChave',
    origem: 'search_term_view',
    // status != EXCLUDED equivale ao antigo filtro por palavra-chave
    // negativa — ad_group_criterion não é filtrável em WHERE junto com
    // FROM search_term_view (QueryError.PROHIBITED_RESOURCE_TYPE_IN_WHERE_CLAUSE).
    filtro: "search_term_view.status != 'EXCLUDED'",
    colunas: [
      ['date', 'segments.date'],
      ['customer_id', 'customer.id'],
      ['customer_name', 'customer.descriptive_name'],
      ['campaign_id', 'campaign.id'],
      ['campaign_name', 'campaign.name'],
      ['keyword', 'segments.keyword.info.text'],
      ['search_term', 'search_term_view.search_term'],
      ['clicks', 'metrics.clicks'],
      ['impressions', 'metrics.impressions'],
      ['cost_micros', 'metrics.cost_micros']
    ]
  }
];

function main() {
  var planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  var fuso = AdsApp.currentAccount().getTimeZone();
  var hoje = new Date();
  var inicio = new Date(hoje.getTime() - DIAS_HISTORICO * 86400000);
  var periodo = "segments.date BETWEEN '" +
    Utilities.formatDate(inicio, fuso, 'yyyy-MM-dd') + "' AND '" +
    Utilities.formatDate(hoje, fuso, 'yyyy-MM-dd') + "'";

  ABAS.forEach(function (aba) {
    try {
      exportarAba(planilha, aba, periodo);
    } catch (e) {
      Logger.log('Falha na aba "' + aba.nome + '": ' + e);
    }
  });
}

function exportarAba(planilha, aba, periodo) {
  var campos = aba.colunas.map(function (c) { return c[1]; });
  var gaql = 'SELECT ' + campos.join(', ') +
    ' FROM ' + aba.origem +
    ' WHERE ' + periodo + ' AND ' + aba.filtro;

  var linhas = [aba.colunas.map(function (c) { return c[0]; })];
  var relatorio = AdsApp.report(gaql).rows();
  while (relatorio.hasNext()) {
    var linha = relatorio.next();
    linhas.push(campos.map(function (campo) {
      var valor = linha[campo];
      return valor === undefined || valor === null ? '' : valor;
    }));
  }

  var destino = planilha.getSheetByName(aba.nome) ||
    planilha.insertSheet(aba.nome);
  destino.clearContents();
  destino.getRange(1, 1, linhas.length, campos.length)
    .setValues(linhas);
  Logger.log('Aba "' + aba.nome + '": ' +
    (linhas.length - 1) + ' linhas.');
}
`;
}
