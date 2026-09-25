import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve quais identificadores externos (ex: identificador de conversão do
 * RD Station) uma integração deve trazer, a partir do que o usuário marcou
 * na tela de seleção de ativos (integration_selected_assets, migration 033).
 *
 * Retorno:
 *   - array com os ids selecionados → o conector filtra estritamente a isso.
 *   - array vazio → nada foi selecionado ainda NUMA INTEGRAÇÃO NOVA — o
 *     conector não deve trazer nada, para não importar tudo indiscriminadamente
 *     antes do usuário escolher (ver comentário da migration 033).
 *   - undefined → integração antiga, que já sincronizava ANTES desta
 *     funcionalidade existir (last_synced_at preenchido) e ainda não passou
 *     pela seleção — trata como "sem filtro" para não interromper uma
 *     sincronização que já funcionava. Assim que o usuário abrir a tela de
 *     seleção de ativos e salvar alguma escolha, o filtro passa a valer.
 */
export async function buscarIdentificadoresSelecionados(
  supabaseAdmin: SupabaseClient,
  integrationId: string
): Promise<string[] | undefined> {
  const [{ data: selecionados, error: erroSelecionados }, { data: integracao, error: erroIntegracao }] = await Promise.all([
    supabaseAdmin.from('integration_selected_assets').select('external_id').eq('integration_id', integrationId),
    supabaseAdmin.from('integrations').select('last_synced_at').eq('id', integrationId).single(),
  ]);

  if (erroSelecionados) throw new Error(erroSelecionados.message);
  if (erroIntegracao) throw new Error(erroIntegracao.message);

  if (selecionados && selecionados.length > 0) {
    return selecionados.map((linha) => linha.external_id as string);
  }

  return integracao?.last_synced_at ? undefined : [];
}
