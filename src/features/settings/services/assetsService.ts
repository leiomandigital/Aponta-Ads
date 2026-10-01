import { supabase } from '@/lib/supabaseClient';

export interface AtivoDisponivel {
  externalId: string;
  name: string;
}

interface ListarAtivosResposta {
  ativos: AtivoDisponivel[];
  selecionados: string[];
  selecaoUnica: boolean;
}

async function obterHeadersAutenticados(): Promise<Record<string, string>> {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error('Sessão expirada — entre novamente');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export const assetsService = {
  /** accountId só importa pro RD Station numa integração compartilhada — cada
   * conta tem sua própria seleção (ver migration 047). Ignorado nas demais. */
  async listar(integrationId: string, accountId: string | null): Promise<ListarAtivosResposta> {
    const headers = await obterHeadersAutenticados();
    const resposta = await fetch('/api/integrations/list-assets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ integrationId, accountId }),
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo.error ?? 'Falha ao listar ativos disponíveis');
    return corpo;
  },

  async salvar(integrationId: string, accountId: string | null, selectedAssets: AtivoDisponivel[]): Promise<void> {
    const headers = await obterHeadersAutenticados();
    const resposta = await fetch('/api/integrations/save-assets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ integrationId, accountId, selectedAssets }),
    });
    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}));
      throw new Error(corpo.error ?? 'Falha ao salvar seleção de ativos');
    }
  },
};
