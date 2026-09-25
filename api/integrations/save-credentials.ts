import type { VercelRequest, VercelResponse } from '@vercel/node';
import { salvarCredenciais } from '../../src/integrations/credentialsVault.js';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import type { IntegrationKey } from '../../src/integrations/types.js';
import { autenticarUsuario } from '../_lib/auth.js';

const CHAVES_VALIDAS: IntegrationKey[] = ['google_ads', 'ga4', 'meta_ads', 'rd_station'];

const NOME_POR_CHAVE: Record<IntegrationKey, string> = {
  google_ads: 'Google Ads',
  ga4: 'Google Analytics 4',
  meta_ads: 'Meta Ads',
  rd_station: 'RD Station',
};

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

  // Duas formas de chamar:
  //   { integrationId, payload } — reconectar uma linha de integrations que já existe.
  //   { integrationKey, accountId, payload } — primeira conexão desta plataforma
  //     nesta conta (accountId null = integração compartilhada). Antes da
  //     migration 026 as 4 linhas já existiam desde a migration 001 e só
  //     recebiam UPDATE; agora uma conta nova pode precisar de uma linha nova.
  const { integrationKey, accountId, integrationId, payload } = req.body ?? {};

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload de credenciais ausente' });
  }

  if (integrationId && typeof integrationId !== 'string') {
    return res.status(400).json({ error: 'integrationId inválido' });
  }

  if (!integrationId && (!integrationKey || !CHAVES_VALIDAS.includes(integrationKey))) {
    return res.status(400).json({ error: 'integrationKey inválida' });
  }

  if (accountId !== undefined && accountId !== null && typeof accountId !== 'string') {
    return res.status(400).json({ error: 'accountId inválido' });
  }

  const supabaseAdmin = criarSupabaseAdminClient();

  try {
    let idAlvo: string = integrationId ?? '';
    // true = essa é a 1ª conexão de verdade desta linha (nasceu agora OU já
    // existia mas nunca tinha sido conectada — ex: conta antiga que herdou uma
    // linha seedada desde a migration 001, nunca usada). Nesses casos ativa
    // sozinho (is_active=true): não faz sentido exigir ligar o switch à mão
    // logo depois de conectar. Reconectar uma linha que já esteve
    // conectada/pendente/com erro NÃO mexe em is_active — o usuário pode ter
    // pausado ela de propósito antes de precisar atualizar a credencial.
    let eraDesconectada = false;

    if (!idAlvo) {
      const chave = integrationKey as IntegrationKey;
      const contaAlvo: string | null = accountId ?? null;

      let consultaExistente = supabaseAdmin.from('integrations').select('id, status').eq('key', chave);
      consultaExistente = contaAlvo ? consultaExistente.eq('account_id', contaAlvo) : consultaExistente.is('account_id', null);

      const { data: existente, error: erroExistente } = await consultaExistente.maybeSingle();
      if (erroExistente) throw new Error(erroExistente.message);

      if (existente) {
        idAlvo = existente.id;
        eraDesconectada = existente.status === 'disconnected';
      } else {
        const { data: nova, error: erroCriacao } = await supabaseAdmin
          .from('integrations')
          .insert({ key: chave, name: NOME_POR_CHAVE[chave], account_id: contaAlvo })
          .select('id')
          .single();

        if (erroCriacao) throw new Error(erroCriacao.message);
        idAlvo = nova.id;
        eraDesconectada = true;
      }
    }

    await salvarCredenciais(idAlvo, payload);

    // Credenciais novas ainda não foram validadas por uma sincronização — 'pending'
    // libera o botão "Sincronizar agora" mesmo se a integração já estava 'connected'.
    const atualizacao: Record<string, unknown> = { status: 'pending', updated_at: new Date().toISOString() };
    if (eraDesconectada) atualizacao.is_active = true;

    const { error: erroStatus } = await supabaseAdmin.from('integrations').update(atualizacao).eq('id', idAlvo);

    if (erroStatus) throw new Error(erroStatus.message);

    return res.status(200).json({ ok: true, integrationId: idAlvo });
  } catch (erro) {
    // Nunca logar o payload aqui — só a mensagem de erro (ver Integration Security Skill, seção 4).
    console.error(`Falha ao salvar credenciais de ${integrationKey ?? integrationId}:`, erro instanceof Error ? erro.message : erro);
    return res.status(500).json({ error: 'Falha ao salvar credenciais' });
  }
}
