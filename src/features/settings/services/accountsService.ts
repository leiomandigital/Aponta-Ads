import { supabase } from '@/lib/supabaseClient';
import type { Account } from '@/types/database.types';

// Código padrão do Postgres pra violação de foreign key — é o que
// integrations_account_id_fkey (on delete restrict, migration 026) devolve
// quando uma conta com integração ainda ligada a ela tenta ser excluída.
const CODIGO_VIOLACAO_FK = '23503';

export const accountsService = {
  async listar(): Promise<Account[]> {
    const { data, error } = await supabase.from('accounts').select('*').order('created_at');
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** ids de conta que já têm ao menos uma integração (mesmo desconectada) — usado só pra decidir se o botão da conta é "excluir" ou "desativar". */
  async listarIdsComIntegracao(): Promise<Set<string>> {
    const { data, error } = await supabase.from('integrations').select('account_id').not('account_id', 'is', null);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((linha) => linha.account_id as string));
  },

  async criar(name: string): Promise<Account> {
    const { data, error } = await supabase.from('accounts').insert({ name }).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async renomear(id: string, name: string): Promise<void> {
    const { error } = await supabase.from('accounts').update({ name, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async ativarDesativar(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.from('accounts').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  /**
   * Exclusão física — só é possível quando a conta nunca teve nenhuma
   * integração ligada a ela; o banco garante isso sozinho (on delete restrict
   * em integrations.account_id), aqui só traduz o erro pra uma mensagem
   * legível. Uma conta que já teve integração/sincronização só pode ser
   * desativada (ativarDesativar), nunca excluída.
   */
  async excluir(id: string): Promise<void> {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) {
      if (error.code === CODIGO_VIOLACAO_FK) {
        throw new Error('Esta conta já tem integração conectada — não pode ser excluída, só desativada.');
      }
      throw new Error(error.message);
    }
  },
};
