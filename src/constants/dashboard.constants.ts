export const ABAS_DASHBOARD = [
  { valor: 'geral', rotulo: 'Geral' },
  { valor: 'google_ads', rotulo: 'Google Ads' },
  { valor: 'meta_ads', rotulo: 'Meta Ads' },
] as const;

export type AbaDashboard = (typeof ABAS_DASHBOARD)[number]['valor'];

export const PERIODOS_DASHBOARD = [
  { valor: '7d', rotulo: '7 dias', dias: 7 },
  { valor: '30d', rotulo: '30 dias', dias: 30 },
  { valor: '90d', rotulo: '90 dias', dias: 90 },
] as const;

// 'custom' não entra em PERIODOS_DASHBOARD (essa lista é só as linhas de
// preset do PeriodPicker) — o intervalo customizado vem de um estado próprio.
export type PeriodoDashboard = (typeof PERIODOS_DASHBOARD)[number]['valor'] | 'custom';


// Visões internas do Geral — o dashboard mostra todas juntas (ver resolverSecoesGeral).
type VisaoGeral = 'executivo' | 'jornada' | 'comparativo';

export type SecaoGeral =
  | 'cards_midia'
  | 'cards_analytics'
  | 'cards_custo_lead'
  | 'cards_conversao'
  | 'graficos'
  | 'grafico_sessoes_leads'
  | 'caminhos'
  | 'leads_por_formulario'
  | 'origem_midia'
  | 'demografia'
  | 'leads_por_etapa'
  | 'paginas'
  | 'dispositivos'
  | 'comparativo_plataformas'
  | 'custo_por_origem'
  | 'leads_recentes';

/**
 * Ordem canônica das seções na tela e no PDF — não importa a ordem em que o
 * usuário marcou as visões, o resultado sai sempre nesta sequência.
 */
const ORDEM_SECOES: SecaoGeral[] = [
  'cards_midia',
  'cards_analytics',
  'cards_custo_lead',
  'cards_conversao',
  'graficos',
  'grafico_sessoes_leads',
  'caminhos',
  'leads_por_formulario',
  'origem_midia',
  'demografia',
  'dispositivos',
  'comparativo_plataformas',
  'leads_recentes',
];

// leads_por_regiao saiu da lista: region vem sempre null do RD Station
// (campaign_region_map ainda não existe — ver src/integrations/rd-station/normalize.ts),
// então a seção só mostrava um bloco "(sem região)" com 100% dos leads,
// sem informação real nenhuma. Volta quando o mapeamento de região existir.
const SECOES_POR_VISAO: Record<VisaoGeral, SecaoGeral[]> = {
  executivo: ['cards_midia', 'cards_analytics', 'graficos'],
  jornada: [
    'cards_analytics',
    'grafico_sessoes_leads',
    'caminhos',
    'leads_por_formulario',
    'origem_midia',
    'dispositivos',
  ],
  comparativo: ['comparativo_plataformas'],
};

/**
 * Fonte única do que aparece no Geral — usada pela tela e pelo PDF
 * (api/export/pdf.ts). Junta as seções de todas as visões sem repetir
 * informação: "Sessões e leads" já está dentro de `graficos`.
 */
export function resolverSecoesGeral(): SecaoGeral[] {
  const uniao = new Set<SecaoGeral>(Object.values(SECOES_POR_VISAO).flat());
  if (uniao.has('graficos')) uniao.delete('grafico_sessoes_leads');
  return ORDEM_SECOES.filter((secao) => uniao.has(secao));
}
