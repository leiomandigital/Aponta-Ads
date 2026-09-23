import { supabase } from '@/lib/supabaseClient';
import type { CampaignRegionMap, DashboardSettings, Integration, Region, SyncLog } from '@/types/database.types';

interface ResultadoSincronizacao {
  status: string;
  errorMessage?: string;
  maisEtapas?: boolean;
}

// Margem generosa acima das ~3 etapas esperadas (180 dias / 60 por etapa) —
// só existe para nunca deixar o navegador preso num laço infinito se a
// matemática de datas do backend tiver algum problema.
const LIMITE_DE_ETAPAS = 8;

async function chamarDispatch(key: string, headers: Record<string, string>): Promise<ResultadoSincronizacao> {
  const resposta = await fetch(`/api/sync/dispatch?integration=${key}`, { method: 'POST', headers });
  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(corpo.error ?? `Falha ao sincronizar ${key}`);
  }

  return corpo;
}

/**
 * Sincroniza uma integração até completar todo o backfill de 180 dias — cada
 * chamada a /api/sync/dispatch busca só uma etapa de 60 dias (para caber no
 * limite de tempo da função na Vercel); enquanto a resposta disser que ainda
 * falta etapa, dispara a próxima sozinho, sem o usuário precisar clicar de
 * novo. Uma etapa com erro interrompe o laço (erro já é claro o suficiente
 * para não insistir sozinho).
 */
async function sincronizarIntegracaoAteCompletar(key: string, headers: Record<string, string>): Promise<ResultadoSincronizacao> {
  let resultado = await chamarDispatch(key, headers);
  let etapas = 1;

  while (resultado.maisEtapas && etapas < LIMITE_DE_ETAPAS) {
    resultado = await chamarDispatch(key, headers);
    etapas++;
  }

  return resultado;
}

export const integrationsService = {
  async listarTodas(): Promise<Integration[]> {
    const { data, error } = await supabase.from('integrations').select('*').order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async ativarDesativar(key: Integration['key'], isActive: boolean): Promise<void> {
    const { error } = await supabase.from('integrations').update({ is_active: isActive }).eq('key', key);
    if (error) throw new Error(error.message);
  },

  /**
   * Dispara a sincronização manual de uma integração específica, avançando
   * sozinho por todas as etapas do backfill até completar (ver
   * sincronizarIntegracaoAteCompletar).
   */
  async sincronizarAgora(key: Integration['key']): Promise<void> {
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const resultado = await sincronizarIntegracaoAteCompletar(key, headers);
    if (resultado.status === 'error') {
      throw new Error(resultado.errorMessage ?? `Falha ao sincronizar ${key}`);
    }
  },

  /**
   * Dispara a sincronização manual de todas as integrações ativas, uma de
   * cada vez — cada integração roda em suas próprias chamadas separadas a
   * /api/sync/dispatch?integration=X (cada uma sua própria execução na
   * Vercel, com seu próprio limite de tempo, e cada uma avançando sozinha
   * por todas as etapas do backfill), em vez de todas dividirem o mesmo
   * cronômetro numa única chamada. Uma falha não impede as demais de rodar.
   */
  async sincronizarTodas(): Promise<{ integration: string; status: string; errorMessage?: string }[]> {
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const integracoes = await this.listarTodas();
    const ativas = integracoes.filter((integracao) => integracao.is_active);

    const resultados: { integration: string; status: string; errorMessage?: string }[] = [];

    for (const integracao of ativas) {
      try {
        const resultado = await sincronizarIntegracaoAteCompletar(integracao.key, headers);
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

  async listarUltimosLogs(limite = 10): Promise<SyncLog[]> {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limite);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async listarCampanhasSemRegiao(): Promise<Array<{ platform: string; campaign_id: string; campaign_name: string | null }>> {
    // Campanhas detectadas na sincronização (ad_performance_daily) que ainda
    // não têm entrada em campaign_region_map.
    const { data: campanhas, error: erroCampanhas } = await supabase
      .from('ad_performance_daily')
      .select('platform, campaign_id, campaign_name')
      .order('campaign_name');
    if (erroCampanhas) throw new Error(erroCampanhas.message);

    const { data: mapeadas, error: erroMapeadas } = await supabase.from('campaign_region_map').select('platform, campaign_id');
    if (erroMapeadas) throw new Error(erroMapeadas.message);

    const chavesMapeadas = new Set((mapeadas ?? []).map((m) => `${m.platform}:${m.campaign_id}`));
    const vistas = new Set<string>();
    const naoMapeadas: Array<{ platform: string; campaign_id: string; campaign_name: string | null }> = [];

    for (const campanha of campanhas ?? []) {
      const chave = `${campanha.platform}:${campanha.campaign_id}`;
      if (chavesMapeadas.has(chave) || vistas.has(chave)) continue;
      vistas.add(chave);
      naoMapeadas.push(campanha);
    }

    return naoMapeadas;
  },

  async listarMapeamentosDeRegiao(): Promise<CampaignRegionMap[]> {
    const { data, error } = await supabase.from('campaign_region_map').select('*').order('campaign_name');
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /**
   * Grava o mapeamento e propaga a região para as linhas históricas já
   * sincronizadas — sem isso, dados de antes do mapeamento ficariam
   * permanentemente sem região.
   */
  async mapearRegiaoDaCampanha(platform: string, campaignId: string, campaignName: string | null, region: Region): Promise<void> {
    const { error: erroUpsert } = await supabase
      .from('campaign_region_map')
      .upsert({ platform, campaign_id: campaignId, campaign_name: campaignName, region }, { onConflict: 'platform,campaign_id' });
    if (erroUpsert) throw new Error(erroUpsert.message);

    const tabelasComRegiao = [
      'ad_performance_daily',
      'ad_conversions_daily',
      'ad_performance_demographics_daily',
      'ad_video_metrics_daily',
    ] as const;

    for (const tabela of tabelasComRegiao) {
      const { error } = await supabase.from(tabela).update({ region }).eq('platform', platform).eq('campaign_id', campaignId);
      if (error) throw new Error(error.message);
    }
  },

  async obterConfiguracoesDoDashboard(): Promise<DashboardSettings | null> {
    const { data, error } = await supabase.from('dashboard_settings').select('*').limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async atualizarConfiguracoesDoDashboard(id: string, dados: Partial<Pick<DashboardSettings, 'client_logo_url' | 'brand_primary_color'>>): Promise<void> {
    const { error } = await supabase.from('dashboard_settings').update(dados).eq('id', id);
    if (error) throw new Error(error.message);
  },
};
