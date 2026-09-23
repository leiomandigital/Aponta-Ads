import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A atribuição de região de uma campanha vem sempre de campaign_region_map —
 * nunca de string matching direto no dado bruto da API. Se a campanha ainda
 * não foi mapeada, o valor fica null; a sugestão automática por nome
 * ("ES"/"TO") acontece só na tela de Configurações (settingsService), como
 * sugestão para o usuário confirmar, nunca como gravação automática aqui.
 *
 * Busca todos os mapeamentos de uma plataforma numa única consulta, em vez
 * de uma consulta por linha — um backfill de 60 dias pode ter centenas de
 * linhas (uma por anúncio/dia), e uma consulta por linha, multiplicada pelas
 * sub-buscas rodando em paralelo, já foi a causa confirmada de uma
 * sincronização estourar o tempo máximo da função na Vercel mesmo com um
 * volume de dado pequeno. O número de CAMPANHAS distintas é sempre muito
 * menor que o de linhas, então uma consulta só resolve tudo.
 */
export async function resolverRegioesDasCampanhas(
  supabaseAdmin: SupabaseClient,
  platform: string
): Promise<Map<string, 'ES' | 'TO'>> {
  const { data, error } = await supabaseAdmin.from('campaign_region_map').select('campaign_id, region').eq('platform', platform);

  if (error) throw new Error(error.message);

  const mapa = new Map<string, 'ES' | 'TO'>();
  for (const linha of data ?? []) {
    mapa.set(linha.campaign_id, linha.region as 'ES' | 'TO');
  }
  return mapa;
}
