import { supabase } from '@/lib/supabaseClient';

export interface LinkDeFormulario {
  externalId: string;
  name: string;
  linkUrl: string | null;
}

async function obterHeadersAutenticados(): Promise<Record<string, string>> {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error('Sessão expirada — entre novamente');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export const rdStationLinksService = {
  async listar(integrationId: string): Promise<LinkDeFormulario[]> {
    const headers = await obterHeadersAutenticados();
    const resposta = await fetch(`/api/integrations/rd-station-links?integrationId=${integrationId}`, { headers });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo.error ?? 'Falha ao listar links dos formulários');
    return corpo.links;
  },

  async salvar(integrationId: string, links: Array<{ externalId: string; linkUrl: string | null }>): Promise<void> {
    const headers = await obterHeadersAutenticados();
    const resposta = await fetch('/api/integrations/rd-station-links', {
      method: 'POST',
      headers,
      body: JSON.stringify({ integrationId, links }),
    });
    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}));
      throw new Error(corpo.error ?? 'Falha ao salvar links dos formulários');
    }
  },
};
