import { criarSupabaseAdminClient } from '../lib/supabaseAdminClient.js';

/**
 * Lê e decripta a credencial de uma integração via Supabase Vault.
 * O schema `vault` não é exposto na Data API, então o acesso passa pelas
 * funções wrapper em `public` (migration 021), executáveis só pelo service_role.
 * Só pode ser chamado server-side (usa a service_role key) — nunca do client.
 * Ver Integration Security Skill, seção 1.
 *
 * Chaveado por integrationId (linha de `integrations`), não mais pela key da
 * plataforma — desde a migration 027, uma mesma key pode ter várias linhas
 * (uma por conta, mais a compartilhada), cada uma com sua própria credencial.
 */
export async function lerCredenciais<T>(integrationId: string): Promise<T | null> {
  const supabaseAdmin = criarSupabaseAdminClient();

  const { data: credencial, error: erroCredencial } = await supabaseAdmin
    .from('integration_credentials')
    .select('encrypted_payload')
    .eq('integration_id', integrationId)
    .maybeSingle();

  if (erroCredencial) throw new Error(erroCredencial.message);
  if (!credencial?.encrypted_payload) return null;

  const { data: segredo, error: erroSegredo } = await supabaseAdmin.rpc('ler_segredo_integracao', {
    p_id: credencial.encrypted_payload,
  });

  if (erroSegredo) throw new Error(erroSegredo.message);
  if (!segredo) return null;

  return JSON.parse(segredo) as T;
}

/**
 * Grava (cria ou sobrescreve) a credencial de uma integração no Vault.
 * Chamado só por /api/integrations/save-credentials.ts. O valor nunca é lido
 * de volta para exibição — reenviar sempre sobrescreve.
 */
export async function salvarCredenciais(integrationId: string, payload: Record<string, unknown>): Promise<void> {
  const supabaseAdmin = criarSupabaseAdminClient();
  const segredoSerializado = JSON.stringify(payload);

  const { data: credencialExistente, error: erroBusca } = await supabaseAdmin
    .from('integration_credentials')
    .select('encrypted_payload')
    .eq('integration_id', integrationId)
    .maybeSingle();

  if (erroBusca) throw new Error(erroBusca.message);

  if (credencialExistente?.encrypted_payload) {
    const { error: erroAtualizacao } = await supabaseAdmin.rpc('atualizar_segredo_integracao', {
      p_id: credencialExistente.encrypted_payload,
      p_segredo: segredoSerializado,
    });
    if (erroAtualizacao) throw new Error(erroAtualizacao.message);
    return;
  }

  const { data: novoUuid, error: erroCriacao } = await supabaseAdmin.rpc('criar_segredo_integracao', {
    p_segredo: segredoSerializado,
    p_nome: `integration_${integrationId}`,
  });

  if (erroCriacao) throw new Error(erroCriacao.message);

  const { error: erroUpsert } = await supabaseAdmin.from('integration_credentials').upsert(
    {
      integration_id: integrationId,
      encrypted_payload: novoUuid,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'integration_id' }
  );

  if (erroUpsert) throw new Error(erroUpsert.message);
}
