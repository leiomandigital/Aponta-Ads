import type { VercelRequest, VercelResponse } from '@vercel/node';
import { salvarCredenciais } from '../../src/integrations/credentialsVault.js';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import type { IntegrationKey } from '../../src/integrations/types.js';
import { autenticarUsuario } from '../_lib/auth.js';

const CHAVES_VALIDAS: IntegrationKey[] = ['google_ads', 'ga4', 'meta_ads', 'rd_station'];

// Rota mais crítica das três (skill 8, seção 2) — é a que grava no Vault.
// Sem a checagem de sessão, seria a porta de entrada mais grave do sistema.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuarioId = await autenticarUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { integrationKey, payload } = req.body ?? {};

  if (!integrationKey || !CHAVES_VALIDAS.includes(integrationKey)) {
    return res.status(400).json({ error: 'integrationKey inválida' });
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload de credenciais ausente' });
  }

  try {
    await salvarCredenciais(integrationKey as IntegrationKey, payload);

    // Credenciais novas ainda não foram validadas por uma sincronização — 'pending'
    // libera o botão "Sincronizar agora" mesmo se a integração já estava 'connected'.
    const { error: erroStatus } = await criarSupabaseAdminClient()
      .from('integrations')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('key', integrationKey);

    if (erroStatus) throw new Error(erroStatus.message);

    return res.status(200).json({ ok: true });
  } catch (erro) {
    // Nunca logar o payload aqui — só a mensagem de erro (ver Integration Security Skill, seção 4).
    console.error(`Falha ao salvar credenciais de ${integrationKey}:`, erro instanceof Error ? erro.message : erro);
    return res.status(500).json({ error: 'Falha ao salvar credenciais' });
  }
}
