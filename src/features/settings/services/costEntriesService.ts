import { supabase } from '@/lib/supabaseClient';
import type { CampaignCostEntry } from '@/types/database.types';

export interface DadosLancamentoDeCusto {
  account_id: string;
  amount: number;
  description: string | null;
}

/** Data do lançamento = hoje, no fuso de São Paulo (não o UTC do navegador, que vira o dia às 21h). */
const hojeSaoPaulo = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export const costEntriesService = {
  /** Lançamentos visíveis para uma conta: os dela + os "gerais" de nenhuma conta específica. */
  async listarPorConta(accountId: string): Promise<CampaignCostEntry[]> {
    const { data, error } = await supabase
      .from('campaign_cost_entries')
      .select('id, account_id, platform, campaign_id, amount, date, description, created_at')
      .or(`account_id.eq.${accountId},account_id.is.null`)
      .order('date', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async criar(dados: DadosLancamentoDeCusto): Promise<void> {
    // Sempre 'todas' e sem campanha: o valor é dividido 50% Google Ads / 50% Meta Ads na leitura.
    const { error } = await supabase.from('campaign_cost_entries').insert({ ...dados, platform: 'todas', campaign_id: null, date: hojeSaoPaulo() });
    if (error) throw new Error(error.message);
  },

  async atualizar(id: string, dados: DadosLancamentoDeCusto): Promise<void> {
    const { error } = await supabase.from('campaign_cost_entries').update({ amount: dados.amount, description: dados.description }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase.from('campaign_cost_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
