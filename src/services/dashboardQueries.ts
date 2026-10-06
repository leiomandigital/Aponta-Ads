import type { SupabaseClient } from '@supabase/supabase-js';
import {
  agruparJornadaDoLead,
  distribuirLeads,
  type DistribuicaoDeLeads,
  type JornadaDoLead,
  type LinhaDetalhamentoLead,
} from '../utils/metricsAggregation.js';
import type { CampaignCostEntry, LeadCostDaily, Platform } from '../types/database.types.js';

export interface FiltrosDashboard {
  dataInicio: string;
  dataFim: string;
  platform?: Platform;
  /**
   * undefined (ou vazio) = todas as contas ativas + as compartilhadas.
   * Com ids = só essas contas (multi-seleção), mais as compartilhadas.
   */
  accountIds?: string[];
  /** Contas desativadas — só é usado quando accountId é undefined (visão "Geral"); numa conta específica ela já não aparece pra ser selecionada. */
  idsContasInativas?: string[];
}

// O Supabase devolve no máximo 1000 linhas por consulta (teto configurável no projeto) e corta o resto sem avisar.
const TAMANHO_PAGINA = 1000;
// Quantos blocos pedir ao mesmo tempo depois do primeiro — rápido sem inundar a API.
const PAGINAS_EM_PARALELO = 5;

interface RespostaPaginada {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
}

/** Consulta já montada (filtros e ordenação), pronta para receber .range(). A ordenação precisa ser estável. */
interface ConsultaPaginavel {
  range(de: number, ate: number): PromiseLike<RespostaPaginada>;
}

/**
 * Lê TODAS as linhas de uma consulta, sem o corte do teto de linhas: o 1º bloco traz também o total (count) e os
 * demais blocos são pedidos em paralelo. `montar` precisa devolver uma consulta NOVA a cada chamada (o builder do
 * Supabase é mutável) e com ordenação estável, senão linhas se repetem ou somem entre os blocos.
 */
async function lerTodasAsLinhas<T>(montar: (opcoes?: { count: 'exact' }) => ConsultaPaginavel): Promise<T[]> {
  const primeiro = await montar({ count: 'exact' }).range(0, TAMANHO_PAGINA - 1);
  if (primeiro.error) throw new Error(primeiro.error.message);

  const linhas = (primeiro.data ?? []) as T[];
  const total = primeiro.count ?? linhas.length;
  // o servidor pode devolver menos que o pedido (teto de linhas do projeto): o tamanho real do 1º bloco manda.
  const tamanho = linhas.length;
  if (tamanho === 0 || total <= tamanho) return linhas;

  const inicios: number[] = [];
  for (let inicio = tamanho; inicio < total; inicio += tamanho) inicios.push(inicio);

  for (let i = 0; i < inicios.length; i += PAGINAS_EM_PARALELO) {
    const blocos = await Promise.all(
      inicios.slice(i, i + PAGINAS_EM_PARALELO).map(async (inicio) => {
        const resposta = await montar().range(inicio, inicio + tamanho - 1);
        if (resposta.error) throw new Error(resposta.error.message);
        return (resposta.data ?? []) as T[];
      })
    );
    for (const bloco of blocos) linhas.push(...bloco);
  }

  return linhas;
}

/**
 * Uma conta específica precisa enxergar tanto as próprias linhas quanto as de
 * qualquer integração COMPARTILHADA (account_id nulo) — um .eq() simples
 * esconderia o dado de uma integração única das visões por conta.
 *
 * accountIds vazio é "todas": soma tudo, MAS excluindo o que pertence a
 * uma conta desativada (ela não deve entrar em somatória nenhuma — só
 * continua existindo no banco). account_id nulo (compartilhado) nunca é
 * excluído aqui: desativar a conta que originalmente compartilhou uma
 * integração não deve tirar o dado das demais contas ainda ativas.
 */
function filtroDeConta(accountIds: string[] | undefined, idsContasInativas: string[] = []): string | null {
  if (accountIds && accountIds.length > 0) return `account_id.in.(${accountIds.join(',')}),account_id.is.null`;
  if (idsContasInativas.length > 0) return `account_id.is.null,account_id.not.in.(${idsContasInativas.join(',')})`;
  return null;
}

/**
 * Consultas do dashboard com o cliente Supabase injetado: o navegador usa o cliente logado (RLS) e o PDF
 * (api/export/pdf.ts) usa o admin — as duas pontas rodam exatamente a mesma consulta.
 */
export function criarDashboardQueries(supabase: SupabaseClient) {
  return {
    /**
     * Linhas brutas de analytics_sessions_daily — totais, série diária e
     * páginas/dispositivos são todos derivados destas mesmas linhas no
     * cliente (ver useDashboardMetrics.ts), numa busca só por período em vez
     * de uma consulta repetida ao banco por card/gráfico que precisa do dado.
     */
    async obterLinhasDeAnalytics(filtros: FiltrosDashboard) {
      const filtroConta = filtroDeConta(filtros.accountIds, filtros.idsContasInativas);

      // vw_analytics_sessions_diario: o mesmo dado de analytics_sessions_daily já somado por dia/dispositivo/conta.
      return lerTodasAsLinhas<{ date: string; device: string | null; account_id: string | null; sessions: number; users: number; leads: number }>(
        (opcoes) => {
          let consulta = supabase
            .from('vw_analytics_sessions_diario')
            .select('date, device, account_id, sessions, users, leads', opcoes)
            .gte('date', filtros.dataInicio)
            .lte('date', filtros.dataFim);
          if (filtroConta) consulta = consulta.or(filtroConta);
          return consulta.order('date').order('device').order('account_id');
        }
      );
    },
    /**
     * Linhas brutas de ad_performance_daily (com granularidade de campanha,
     * conjunto de anúncio e anúncio) — KPIs, gráfico e as três tabelas de
     * drill-down (campanha → conjunto → anúncio) são todos derivados destas
     * mesmas linhas no cliente, sem consulta adicional ao banco por seleção.
     */
    async obterLinhasDeMidia(filtros: FiltrosDashboard) {
      const filtroContaMidia = filtroDeConta(filtros.accountIds, filtros.idsContasInativas);

      return lerTodasAsLinhas<{
        date: string;
        platform: string;
        campaign_id: string;
        campaign_name: string | null;
        adset_id: string | null;
        adset_name: string | null;
        ad_id: string | null;
        ad_name: string | null;
        impressions: number;
        clicks: number;
        cost: number;
        conversions: number;
      }>((opcoes) => {
        let consulta = supabase
          .from('ad_performance_daily')
          .select('date, platform, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, impressions, clicks, cost, conversions', opcoes)
          .gte('date', filtros.dataInicio)
          .lte('date', filtros.dataFim);
        if (filtros.platform) consulta = consulta.eq('platform', filtros.platform);
        if (filtroContaMidia) consulta = consulta.or(filtroContaMidia);
        return consulta.order('id');
      });
    },

    /**
     * Jornada do lead vinda do GA4 (caminho, origem, demografia, retorno, tempo até converter) —
     * lida em páginas porque o volume (dias x combinações) passa do limite de 1000 linhas por consulta.
     */
    async obterJornadaDoLead(
      filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'accountIds' | 'idsContasInativas'>
    ): Promise<JornadaDoLead> {
      const filtroContaJornada = filtroDeConta(filtros.accountIds, filtros.idsContasInativas);

      const linhas = await lerTodasAsLinhas<LinhaDetalhamentoLead>((opcoes) => {
        let consulta = supabase
          .from('analytics_lead_breakdown_daily')
          .select('kind, dim1, dim2, dim3, leads', opcoes)
          .gte('date', filtros.dataInicio)
          .lte('date', filtros.dataFim);
        if (filtroContaJornada) consulta = consulta.or(filtroContaJornada);
        return consulta.order('date').order('id');
      });

      return agruparJornadaDoLead(linhas);
    },

    /** Link público de cada formulário do RD Station (external_id = identificador da conversão), cadastrado em Configurações. */
    async obterLinksDeFormularios(): Promise<Record<string, string>> {
      const { data, error } = await supabase.from('integration_discovered_assets').select('external_id, link_url').not('link_url', 'is', null);
      if (error) throw new Error(error.message);
      const links: Record<string, string> = {};
      for (const linha of data ?? []) if (linha.link_url) links[linha.external_id as string] = linha.link_url as string;
      return links;
    },

    /** Distribuição de leads por origem, etapa do funil e região — só contagem, sem nome/e-mail. */
    async obterDistribuicaoDeLeads(
      filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'accountIds' | 'idsContasInativas'>
    ): Promise<DistribuicaoDeLeads> {
      const filtroContaLeads = filtroDeConta(filtros.accountIds, filtros.idsContasInativas);

      const leads = await lerTodasAsLinhas<{ source: string | null; funnel_stage: string | null; region: string | null; event_identifier: string | null }>(
        (opcoes) => {
          let consulta = supabase
            .from('leads')
            .select('source, funnel_stage, region, event_identifier', opcoes)
            .gte('captured_at', filtros.dataInicio)
            .lte('captured_at', `${filtros.dataFim}T23:59:59.999`);
          if (filtroContaLeads) consulta = consulta.or(filtroContaLeads);
          return consulta.order('id');
        }
      );
      return distribuirLeads(leads);
    },

    async obterLeadsRecentes(filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'accountIds' | 'idsContasInativas'>) {
      // captured_at é timestamptz — comparar com uma data pura ("2026-09-28")
      // ancora em meia-noite, excluindo qualquer lead capturado depois disso no
      // próprio dia final do período (na prática, quase todo lead de "hoje").
      // vw_lead_cost_daily não tem esse problema (compara por captured_at::date),
      // por isso um lead de hoje aparecia lá mas sumia daqui — precisa do fim do
      // dia inteiro aqui também.
      let consulta = supabase
        .from('leads')
        .select('id, name, email, source, funnel_stage, region, captured_at')
        .gte('captured_at', filtros.dataInicio)
        .lte('captured_at', `${filtros.dataFim}T23:59:59.999`)
        .order('captured_at', { ascending: false })
        .limit(50);

      const filtroContaLeads = filtroDeConta(filtros.accountIds, filtros.idsContasInativas);
      if (filtroContaLeads) consulta = consulta.or(filtroContaLeads);

      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    async obterCustoPorLeadPorOrigem(
      filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'accountIds' | 'idsContasInativas'>
    ): Promise<LeadCostDaily[]> {
      const filtroContaCusto = filtroDeConta(filtros.accountIds, filtros.idsContasInativas);

      return lerTodasAsLinhas<LeadCostDaily>((opcoes) => {
        let consulta = supabase
          .from('vw_lead_cost_daily')
          .select('*', opcoes)
          .gte('date', filtros.dataInicio)
          .lte('date', filtros.dataFim);
        if (filtroContaCusto) consulta = consulta.or(filtroContaCusto);
        // (date, source, account_id) é a chave da view — ordenação estável.
        return consulta.order('date', { ascending: false }).order('source').order('account_id');
      });
    },

    /** Lançamentos manuais de custo avulso no período — ver campaign_cost_entries (taxa da plataforma é calculada, não lançada). */
    async obterLancamentosDeCusto(
      filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'platform' | 'accountIds' | 'idsContasInativas'>
    ): Promise<CampaignCostEntry[]> {
      const filtroContaLancamentos = filtroDeConta(filtros.accountIds, filtros.idsContasInativas);

      const data = await lerTodasAsLinhas<CampaignCostEntry>((opcoes) => {
        let consulta = supabase
          .from('campaign_cost_entries')
          .select('id, account_id, platform, campaign_id, amount, date, description, created_at', opcoes)
          .gte('date', filtros.dataInicio)
          .lte('date', filtros.dataFim);
        // 'todas' entra em qualquer plataforma: é dividido 50/50 logo abaixo.
        if (filtros.platform) consulta = consulta.in('platform', [filtros.platform, 'todas']);
        if (filtroContaLancamentos) consulta = consulta.or(filtroContaLancamentos);
        return consulta.order('id');
      });

      const divididos = data.flatMap((entrada): CampaignCostEntry[] =>
        entrada.platform === 'todas'
          ? (['google_ads', 'meta_ads'] as const).map((platform) => ({ ...entrada, id: `${entrada.id}:${platform}`, platform, amount: entrada.amount / 2 }))
          : [entrada]
      );
      return filtros.platform ? divididos.filter((entrada) => entrada.platform === filtros.platform) : divididos;
    },
  };
}
