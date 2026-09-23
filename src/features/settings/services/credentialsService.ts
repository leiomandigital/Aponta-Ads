import { supabase } from '@/lib/supabaseClient';

export const credentialsService = {
  /** Chama /api/integrations/save-credentials — única rota que grava no Vault. */
  async salvar(integrationKey: string, payload: Record<string, string>): Promise<void> {
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    if (!token) throw new Error('Sessão expirada — entre novamente');

    const resposta = await fetch('/api/integrations/save-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ integrationKey, payload }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}));
      throw new Error(corpo.error ?? 'Falha ao salvar credenciais');
    }
  },
};
