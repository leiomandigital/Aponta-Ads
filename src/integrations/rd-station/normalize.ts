import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { linhasParaGravar } from '../diffUpsert.js';

// error.message sozinho geralmente omite a causa real (nome da constraint
// violada, coluna com tipo errado, etc.) — details/hint/code do Postgrest
// carregam isso. Sem eles, erro de FK/tipo aparece só como "Bad Request"
// genérico no cliente, sem dar pra saber o que quebrou de verdade.
function formatarErroSupabase(erro: PostgrestError): string {
  return [erro.message, erro.details, erro.hint, erro.code].filter(Boolean).join(' | ');
}

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

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
  /** Objeto "contact" inteiro do payload do webhook (telefone, cargo,
   * empresa, tags, campos personalizados cf_* do formulário, etc.) — guardado
   * cru em leads.raw_data pra uso futuro, sem virar coluna própria de cada
   * campo. Ver doc "Webhooks MKT payload". */
  rawContact?: Record<string, unknown>;
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
//
// Nunca devolve null: o índice único de leads é (source, external_id) e, no
// Postgres, NULL nunca colide com NULL num índice único — um lead sem
// origem (ex: conversão direta, sem UTM) nunca seria reconhecido como
// duplicata do mesmo external_id e acabava inserido de novo a cada retry do
// webhook (visto na prática: a mesma pessoa 3x na tabela). String vazia
// resolve porque '' == '' colide normalmente.
function resolverSource(origin: string | undefined): string {
  if (!origin) return '';
  const partes = origin.split('|').map((parte) => parte.trim());
  const fonte = partes[partes.length - 1]?.toLowerCase();
  if (!fonte) return '';
  return MAPA_UTM_SOURCE_PARA_PLATAFORMA[fonte] ?? fonte;
}

function montarLinha(lead: RDStationWebhookLead, accountId: string | null) {
  return {
    external_id: lead.uuid,
    name: lead.name ?? null,
    email: lead.email,
    source: resolverSource(lead.origin),
    funnel_stage: lead.lifecycleStage ?? null,
    event_identifier: lead.eventIdentifier,
    // captured_at é a data REAL do evento, devolvida pela própria RD Station
    // no payload — nunca o default now() de created_at. Ver migration 015.
    captured_at: lead.eventTimestamp,
    // Região depende de UTM de campanha padronizado cruzado com
    // campaign_region_map (trabalho ainda em andamento) — fica null por ora.
    region: null as string | null,
    account_id: accountId,
    raw_data: lead.rawContact ?? null,
  };
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

  // Dedupe por (source, external_id) ANTES de montar o upsert: se a mesma
  // pessoa converteu mais de uma vez no mesmo identificador enquanto ele
  // ainda não estava selecionado, o backfill (save-assets.ts) manda todas
  // as ocorrências pendentes numa chamada só — duas linhas com a mesma
  // chave no mesmo upsert faz o Postgres recusar com "ON CONFLICT DO UPDATE
  // command cannot affect row a second time". Um Map mantém só a última
  // ocorrência de cada chave (a array já chega em ordem cronológica).
  const linhasPorChave = new Map<string, ReturnType<typeof montarLinha>>();
  for (const lead of leads) {
    const linha = montarLinha(lead, accountId);
    linhasPorChave.set(`${linha.source}|${linha.external_id}`, linha);
  }
  const linhasNormalizadas = [...linhasPorChave.values()];

  // external_id já é o uuid que a própria RD Station atribui ao contato —
  // único globalmente, então filtrar direto por ele é mais simples e preciso
  // do que recortar por intervalo de data. Em lotes pequenos: uma lista de
  // ids grande (ex.: backfill retroativo de um identificador com muitas
  // conversões acumuladas) já causou "Bad Request" sem detalhe nenhum vindo
  // do Postgrest só em produção — não reproduzido testando a mesma consulta
  // direto contra o Supabase. Lotes menores reduzem a chance de esbarrar
  // nisso de novo e, se mesmo assim falhar, o log abaixo mostra em qual lote.
  const TAMANHO_LOTE = 30;
  const existentes: Array<Record<string, unknown>> = [];
  for (const lote of emLotes(linhasNormalizadas, TAMANHO_LOTE)) {
    const { data, error: erroExistentes } = await supabaseAdmin
      .from('leads')
      .select('source, external_id, name, email, funnel_stage, event_identifier, captured_at, region, account_id')
      .in(
        'external_id',
        lote.map((linha) => linha.external_id)
      );
    if (erroExistentes) {
      console.error('leads.select falhou — erro completo:', JSON.stringify(erroExistentes), 'ids do lote:', lote.map((l) => l.external_id));
      throw new Error(`leads.select (lote de ${lote.length} ids): ${formatarErroSupabase(erroExistentes)}`);
    }
    existentes.push(...(data ?? []));
  }

  const paraGravar = linhasParaGravar(
    linhasNormalizadas,
    existentes,
    ['source', 'external_id'],
    ['name', 'email', 'funnel_stage', 'event_identifier', 'captured_at', 'region', 'account_id']
  );
  if (paraGravar.length === 0) return 0;

  for (const lote of emLotes(paraGravar, TAMANHO_LOTE)) {
    const { error } = await supabaseAdmin.from('leads').upsert(lote, { onConflict: 'source,external_id' });
    if (error) {
      console.error('leads.upsert falhou — erro completo:', JSON.stringify(error), 'ids do lote:', lote.map((l) => l.external_id));
      throw new Error(`leads.upsert (lote de ${lote.length} linhas): ${formatarErroSupabase(error)}`);
    }
  }
  return paraGravar.length;
}
