import { supabase } from '@/lib/supabaseClient';
import type { DashboardSettings, Integration, IntegrationKey, SyncLog } from '@/types/database.types';

// Tabelas de dado gravadas por cada plataforma — usado só para reatribuir o
// histórico já sincronizado quando uma integração vira/deixa de ser
// compartilhada (ver reatribuirHistorico). ad_keyword_performance_daily e
// analytics_sessions_daily/leads não têm coluna platform/source batendo com a
// key da integração, mas cada uma só é gravada por um único conector, então
// filtrar só por account_id já isola exatamente o que é dessa integração.
const TABELAS_COM_PLATFORM = [
  'ad_performance_daily',
  'ad_conversions_daily',
  'ad_performance_demographics_daily',
  'ad_video_metrics_daily',
] as const;

/**
 * Reatribui o histórico já sincronizado por uma integração entre "compartilhado"
 * (account_id nulo) e "exclusivo de uma conta" — nas duas direções: virar
 * compartilhada reatribui o que era da conta anterior pra null; deixar de ser
 * reatribui o que estava null de volta pra conta que desmarcou. Sem isso, o
 * histórico ficaria "preso" no estado antigo até a PRÓXIMA sincronização de
 * cada lado (e no caso de desmarcar, ficaria compartilhado pra sempre, já que
 * nada mais tornaria a gravar account_id nulo pra essas linhas).
 *
 * As duas direções são seguras (sem risco de misturar histórico de conexões
 * diferentes) porque só pode existir NO MÁXIMO UMA integração compartilhada
 * por plataforma ao mesmo tempo (índice único parcial da migration 029) — o
 * histórico com account_id nulo de uma key só pode pertencer à conexão
 * compartilhada atual dela.
 */
async function reatribuirHistorico(key: IntegrationKey, contaOrigem: string | null, contaDestino: string | null): Promise<void> {
  const aplicarFiltroOrigem = <T extends { eq(coluna: string, valor: string): T; is(coluna: string, valor: null): T }>(
    consulta: T
  ): T => (contaOrigem === null ? consulta.is('account_id', contaOrigem) : consulta.eq('account_id', contaOrigem));

  if (key === 'google_ads' || key === 'meta_ads') {
    for (const tabela of TABELAS_COM_PLATFORM) {
      const { error } = await aplicarFiltroOrigem(
        supabase.from(tabela).update({ account_id: contaDestino }).eq('platform', key)
      );
      if (error) throw new Error(error.message);
    }
    if (key === 'google_ads') {
      const { error } = await aplicarFiltroOrigem(supabase.from('ad_keyword_performance_daily').update({ account_id: contaDestino }));
      if (error) throw new Error(error.message);
    }
  } else if (key === 'ga4') {
    const { error } = await aplicarFiltroOrigem(supabase.from('analytics_sessions_daily').update({ account_id: contaDestino }));
    if (error) throw new Error(error.message);
    const { error: erroDetalhamento } = await aplicarFiltroOrigem(
      supabase.from('analytics_lead_breakdown_daily').update({ account_id: contaDestino })
    );
    if (erroDetalhamento) throw new Error(erroDetalhamento.message);
  } else if (key === 'rd_station') {
    const { error } = await aplicarFiltroOrigem(supabase.from('leads').update({ account_id: contaDestino }));
    if (error) throw new Error(error.message);
  }
}

interface ResultadoSincronizacao {
  status: string;
  errorMessage?: string;
  maisEtapas?: boolean;
}

// Margem generosa acima das ~3 etapas esperadas (180 dias / 60 por etapa) —
// só existe para nunca deixar o navegador preso num laço infinito se a
// matemática de datas do backend tiver algum problema.
const LIMITE_DE_ETAPAS = 8;

// Código padrão do Postgres para violação de unique/exclusion constraint —
// usado aqui pra dar uma mensagem legível quando alternarCompartilhamento
// esbarra nos índices únicos parciais da migration 029 (1 compartilhada por
// plataforma, 1 própria por conta+plataforma).
const CODIGO_VIOLACAO_UNIQUE = '23505';

async function chamarDispatch(integrationId: string, headers: Record<string, string>, runId: string): Promise<ResultadoSincronizacao> {
  const resposta = await fetch(`/api/sync/dispatch?integration=${integrationId}&runId=${runId}`, { method: 'POST', headers });
  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(corpo.error ?? 'Falha ao sincronizar');
  }

  return corpo;
}

/**
 * Sincroniza uma integração até completar todo o backfill de 180 dias — cada
 * chamada a /api/sync/dispatch busca só uma etapa de 30 dias (para caber no
 * limite de tempo da função na Vercel); enquanto a resposta disser que ainda
 * falta etapa, dispara a próxima sozinho, sem o usuário precisar clicar de
 * novo. Uma etapa com erro interrompe o laço (erro já é claro o suficiente
 * para não insistir sozinho).
 *
 * Todas as etapas deste clique levam o mesmo runId (gerado uma vez só aqui),
 * pra tela de histórico poder agrupá-las como um evento só (migration 037).
 */
async function sincronizarIntegracaoAteCompletar(integrationId: string, headers: Record<string, string>): Promise<ResultadoSincronizacao> {
  const runId = crypto.randomUUID();
  let resultado = await chamarDispatch(integrationId, headers, runId);
  let etapas = 1;

  while (resultado.maisEtapas && etapas < LIMITE_DE_ETAPAS) {
    resultado = await chamarDispatch(integrationId, headers, runId);
    etapas++;
  }

  return resultado;
}

async function obterHeadersAutenticados(): Promise<Record<string, string>> {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const integrationsService = {
  /** Todas as linhas de integrations, de todas as contas — usado pelo botão global "sincronizar todas". */
  async listarTodas(): Promise<Integration[]> {
    const { data, error } = await supabase.from('integrations').select('*').order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /**
   * Linhas visíveis para uma conta: as próprias dela + as compartilhadas
   * (account_id nulo) — uma integração "única" marcada em qualquer conta
   * aparece automaticamente em todas.
   */
  async listarPorConta(accountId: string): Promise<Integration[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .or(`account_id.eq.${accountId},account_id.is.null`)
      .order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async ativarDesativar(integrationId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.from('integrations').update({ is_active: isActive }).eq('id', integrationId);
    if (error) throw new Error(error.message);
  },

  /**
   * Alterna uma integração entre "própria de uma conta" e "compartilhada"
   * (novoAccountId null). contaAtualId é a conta de onde o clique partiu —
   * gravada em shared_from_account_id quando marca como compartilhada, pra
   * só ela poder desmarcar depois (ver IntegrationCard.tsx, que desabilita o
   * controle nas demais contas). Pode falhar com violação de unique se já
   * existir outra conexão no destino (ex: já tem uma compartilhada desta
   * plataforma) — traduzida numa mensagem legível em vez do erro cru do Postgres.
   */
  async alternarCompartilhamento(integrationId: string, novoAccountId: string | null, contaAtualId: string): Promise<void> {
    const { data: atual, error: erroAtual } = await supabase
      .from('integrations')
      .select('key, account_id')
      .eq('id', integrationId)
      .single();
    if (erroAtual) throw new Error(erroAtual.message);

    const atualizacao = {
      account_id: novoAccountId,
      shared_from_account_id: novoAccountId === null ? contaAtualId : null,
    };

    const { error } = await supabase.from('integrations').update(atualizacao).eq('id', integrationId);
    if (error) {
      if (error.code === CODIGO_VIOLACAO_UNIQUE) {
        throw new Error(
          novoAccountId === null
            ? 'Já existe uma conexão compartilhada desta plataforma — desmarque a outra antes.'
            : 'Esta conta já tem uma conexão própria desta plataforma.'
        );
      }
      throw new Error(error.message);
    }

    // account_id realmente mudou de "compartilhado" pra "de uma conta" ou
    // vice-versa (não dispara nada se já estava lá, ex: reafirmar o mesmo
    // valor) — reatribui o histórico já sincronizado pra acompanhar.
    if (atual.account_id !== novoAccountId) {
      await reatribuirHistorico(atual.key, atual.account_id, novoAccountId);
    }
  },

  /**
   * Dispara a sincronização manual de uma integração específica, avançando
   * sozinho por todas as etapas do backfill até completar (ver
   * sincronizarIntegracaoAteCompletar).
   */
  async sincronizarAgora(integrationId: string): Promise<void> {
    const headers = await obterHeadersAutenticados();
    const resultado = await sincronizarIntegracaoAteCompletar(integrationId, headers);
    if (resultado.status === 'error') {
      throw new Error(resultado.errorMessage ?? 'Falha ao sincronizar');
    }
  },

  /**
   * Dispara a sincronização manual de todas as integrações ativas (de todas
   * as contas), uma de cada vez — cada uma roda em suas próprias chamadas
   * separadas a /api/sync/dispatch?integration=<id> (cada uma sua própria
   * execução na Vercel, com seu próprio limite de tempo, e cada uma avançando
   * sozinha por todas as etapas do backfill). Uma falha não impede as demais.
   */
  async sincronizarTodas(): Promise<{ integration: string; status: string; errorMessage?: string }[]> {
    const headers = await obterHeadersAutenticados();
    const integracoes = await this.listarTodas();
    const ativas = integracoes.filter((integracao) => integracao.is_active);

    const resultados: { integration: string; status: string; errorMessage?: string }[] = [];

    for (const integracao of ativas) {
      try {
        const resultado = await sincronizarIntegracaoAteCompletar(integracao.id, headers);
        resultados.push({ integration: integracao.key, ...resultado });
      } catch (erro) {
        resultados.push({
          integration: integracao.key,
          status: 'error',
          errorMessage: erro instanceof Error ? erro.message : `Falha ao sincronizar ${integracao.key}`,
        });
      }
    }

    return resultados;
  },

  /** integrationId undefined = últimos logs de todas as integrações; informado = só os de uma. */
  async listarUltimosLogs(integrationId?: string, limite = 10): Promise<SyncLog[]> {
    let consulta = supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(limite);
    if (integrationId) consulta = consulta.eq('integration_id', integrationId);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /**
   * dashboard_settings é uma linha única — cria sozinha se não existir (em
   * vez de depender de uma migration/seed manual, que é fácil de esquecer
   * numa instância nova pro cliente e deixa "Enviar logo" silenciosamente sem
   * efeito, sem erro nenhum pra avisar).
   */
  async obterConfiguracoesDoDashboard(): Promise<DashboardSettings> {
    const { data, error } = await supabase.from('dashboard_settings').select('*').limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;

    const { data: nova, error: erroCriacao } = await supabase.from('dashboard_settings').insert({}).select('*').single();
    if (erroCriacao) throw new Error(erroCriacao.message);
    return nova;
  },

  async atualizarConfiguracoesDoDashboard(
    id: string,
    dados: Partial<Pick<DashboardSettings, 'client_logo_url' | 'system_name'>>
  ): Promise<void> {
    const { error } = await supabase.from('dashboard_settings').update(dados).eq('id', id);
    if (error) throw new Error(error.message);
  },
};
