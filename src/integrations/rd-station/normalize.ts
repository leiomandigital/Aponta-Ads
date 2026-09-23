import type { SupabaseClient } from '@supabase/supabase-js';

interface RDStationConversion {
  uuid: string;
  name?: string;
  email: string;
  created_at: string;
  cf_utm_source?: string;
  cf_utm_campaign?: string;
  lifecycle_stage?: string;
}

// leads.source precisa bater com ad_performance_daily.platform para
// vw_lead_cost_daily funcionar — traduz o utm_source cru para a chave interna.
const MAPA_UTM_SOURCE_PARA_PLATAFORMA: Record<string, string> = {
  google: 'google_ads',
  googleads: 'google_ads',
  facebook: 'meta_ads',
  instagram: 'meta_ads',
  meta: 'meta_ads',
};

function resolverSource(utmSource: string | undefined): string | null {
  if (!utmSource) return null;
  return MAPA_UTM_SOURCE_PARA_PLATAFORMA[utmSource.toLowerCase()] ?? utmSource;
}

export async function normalizarEGravarLeads(
  supabaseAdmin: SupabaseClient,
  conversoes: RDStationConversion[]
): Promise<number> {
  if (conversoes.length === 0) return 0;

  const linhasNormalizadas = conversoes.map((conversao) => ({
    external_id: conversao.uuid,
    name: conversao.name ?? null,
    email: conversao.email,
    source: resolverSource(conversao.cf_utm_source),
    funnel_stage: conversao.lifecycle_stage ?? null,
    // captured_at é a data REAL do lead, devolvida pela própria API do RD
    // Station — nunca o default now() de created_at. Ver migration 015.
    captured_at: conversao.created_at,
    // Região depende de UTM de campanha padronizado cruzado com
    // campaign_region_map (trabalho ainda em andamento) — fica null por ora.
    region: null,
  }));

  const { error } = await supabaseAdmin
    .from('leads')
    .upsert(linhasNormalizadas, { onConflict: 'source,external_id' });

  if (error) throw new Error(error.message);
  return linhasNormalizadas.length;
}
