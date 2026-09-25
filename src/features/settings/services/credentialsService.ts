import { supabase } from '@/lib/supabaseClient';
import type { IntegrationKey } from '@/types/database.types';

interface SalvarParams {
  /** Reconectar uma linha existente — quando informado, accountId/integrationKey são ignorados pelo backend. */
  integrationId?: string;
  /** Primeira conexão desta plataforma numa conta — o backend cria a linha se ainda não existir. */
  integrationKey?: IntegrationKey;
  /** null = integração compartilhada ("única"). Só faz sentido junto de integrationKey. */
  accountId?: string | null;
  payload: Record<string, string>;
}

export const credentialsService = {
  /** Chama /api/integrations/save-credentials — única rota que grava no Vault. */
  async salvar({ integrationId, integrationKey, accountId, payload }: SalvarParams): Promise<{ integrationId: string }> {
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    if (!token) throw new Error('Sessão expirada — entre novamente');

    const resposta = await fetch('/api/integrations/save-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ integrationId, integrationKey, accountId, payload }),
    });

    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(corpo.error ?? 'Falha ao salvar credenciais');
    }
    return corpo;
  },
};
