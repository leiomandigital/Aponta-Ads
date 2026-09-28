import type { SupabaseClient } from '@supabase/supabase-js';
import { linhasParaGravar } from '../diffUpsert.js';

// Formato de UM contato recebido via webhook WEBHOOK.CONVERTED — não é mais o
// formato de GET /platform/conversions (esse endpoint não existe de verdade
// na API do RD Station Marketing; ver decisão de arquitetura). Ver doc
// "Webhooks MKT payload" pro shape completo que a RD Station envia.
export interface RDStationWebhookLead {
  uuid: string;
  email: string;
  name?: string;
  eventIdentifier: string;
  eventTimestamp: string;
  lifecycleStage?: string;
  origin?: string;
}

// leads.source precisa bater com ad_performance_daily.platform para
// vw_lead_cost_daily funcionar — traduz a origem crua para a chave interna.
const MAPA_UTM_SOURCE_PARA_PLATAFORMA: Record<string, string> = {
  google: 'google_ads',
  googleads: 'google_ads',
  facebook: 'meta_ads',
  instagram: 'meta_ads',
  meta: 'meta_ads',
};

// O payload do webhook manda `origin` já combinado como "<meio> | <fonte>"
// (ex: "Busca Paga | Google", "Direto") — diferente do cf_utm_source
// separado que a versão antiga (baseada no endpoint inexistente) esperava.
// Pega o último pedaço e usa como fonte.
function resolverSource(origin: string | undefined): string | null {
  if (!origin) return null;
  const partes = origin.split('|').map((parte) => parte.trim());
  const fonte = partes[partes.length - 1]?.toLowerCase();
  if (!fonte) return null;
  return MAPA_UTM_SOURCE_PARA_PLATAFORMA[fonte] ?? fonte;
}

/**
 * Recebe 1 (sempre 1, na prática — cada chamada do webhook é um evento só)
 * ou mais leads já filtrados pela seleção de ativos e grava em `leads`.
 * Mantém o formato em array e o diff via linhasParaGravar (em vez de um
 * insert direto) para ficar idempotente: se a RD Station reenviar o mesmo
 * evento (retry de webhook), não duplica nem regrava à toa.
 */
export async function normalizarEGravarLeads(
  supabaseAdmin: SupabaseClient,
  leads: RDStationWebhookLead[],
  accountId: string | null
): Promise<number> {
  if (leads.length === 0) return 0;

  const linhasNormalizadas = leads.map((lead) => ({
    external_id: lead.uuid,
    name: lead.name ?? null,
    email: lead.email,
    source: resolverSource(lead.origin),
    funnel_stage: lead.lifecycleStage ?? null,
    // captured_at é a data REAL do evento, devolvida pela própria RD Station
    // no payload — nunca o default now() de created_at. Ver migration 015.
    captured_at: lead.eventTimestamp,
    // Região depende de UTM de campanha padronizado cruzado com
    // campaign_region_map (trabalho ainda em andamento) — fica null por ora.
    region: null,
    account_id: accountId,
  }));

  // external_id já é o uuid que a própria RD Station atribui ao contato —
  // único globalmente, então filtrar direto por ele é mais simples e preciso
  // do que recortar por intervalo de data.
  const { data: existentes, error: erroExistentes } = await supabaseAdmin
    .from('leads')
    .select('source, external_id, name, email, funnel_stage, captured_at, region, account_id')
    .in(
      'external_id',
      linhasNormalizadas.map((linha) => linha.external_id)
    );
  if (erroExistentes) throw new Error(erroExistentes.message);

  const paraGravar = linhasParaGravar(
    linhasNormalizadas,
    existentes ?? [],
    ['source', 'external_id'],
    ['name', 'email', 'funnel_stage', 'captured_at', 'region', 'account_id']
  );
  if (paraGravar.length === 0) return 0;

  const { error } = await supabaseAdmin.from('leads').upsert(paraGravar, { onConflict: 'source,external_id' });

  if (error) throw new Error(error.message);
  return paraGravar.length;
}
