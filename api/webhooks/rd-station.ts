import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { obterCredenciais } from '../../src/integrations/rd-station/auth.js';
import { normalizarEGravarLeads, type RDStationWebhookLead } from '../../src/integrations/rd-station/normalize.js';

interface PayloadWebhookRD {
  event_type?: string;
  event_identifier?: string;
  event_timestamp?: string;
  contact?: {
    uuid?: string;
    email?: string;
    name?: string;
    funnel?: { lifecycle_stage?: string };
    origin?: string;
  };
}

/**
 * Recebe os eventos WEBHOOK.CONVERTED que a RD Station empurra em tempo
 * real — não existe endpoint de "listar conversões por período" na API do
 * RD Station Marketing, então este é o único jeito de receber lead a lead
 * (ver decisão de arquitetura, registrada na conversa que criou este
 * arquivo). A RD Station testa esta URL com uma chamada de validação ao
 * criar a assinatura (webhookRegistration.ts) e exige 2xx; reenvia a cada
 * conversão real depois.
 *
 * Autenticação via query string (integrationId + secret), não header: a API
 * de criação de webhook da RD Station não aceita header customizado nem
 * assina o payload — ver RDStationCredentials.webhookSecret.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const integrationId = typeof req.query.integrationId === 'string' ? req.query.integrationId : undefined;
  const secret = typeof req.query.secret === 'string' ? req.query.secret : undefined;
  if (!integrationId || !secret) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const credenciais = await obterCredenciais(integrationId).catch(() => null);
  if (!credenciais || !credenciais.webhookSecret || credenciais.webhookSecret !== secret) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // Dali em diante a assinatura já foi validada — qualquer falha de
  // processamento ainda responde 200, para não arriscar a RD Station
  // desativar a assinatura por causa de um erro nosso (ela só documenta a
  // exigência de 2xx na criação, mas reenvios/erros consistentes em
  // produção não valem o risco).
  try {
    const payload = (req.body ?? {}) as PayloadWebhookRD;

    if (
      payload.event_type !== 'WEBHOOK.CONVERTED' ||
      !payload.event_identifier ||
      !payload.contact?.uuid ||
      !payload.contact.email
    ) {
      return res.status(200).json({ ok: true, ignorado: true });
    }

    const supabaseAdmin = criarSupabaseAdminClient();

    const leadDoEvento: RDStationWebhookLead = {
      uuid: payload.contact.uuid,
      email: payload.contact.email,
      name: payload.contact.name,
      eventIdentifier: payload.event_identifier,
      eventTimestamp: payload.event_timestamp ?? new Date().toISOString(),
      lifecycleStage: payload.contact.funnel?.lifecycle_stage,
      origin: payload.contact.origin,
    };

    // Grava como "já visto" independente de estar selecionado — é o que
    // alimenta a tela de seleção de ativos daqui pra frente.
    const { error: erroDescoberta } = await supabaseAdmin.from('integration_discovered_assets').upsert(
      { integration_id: integrationId, external_id: payload.event_identifier, name: payload.event_identifier },
      { onConflict: 'integration_id,external_id', ignoreDuplicates: true }
    );
    if (erroDescoberta) {
      console.error('RD Station webhook: falha ao registrar ativo descoberto:', erroDescoberta.message);
    }

    // A chave "Ativa a sincronização automática" (IntegrationCard.tsx) não
    // tem cron/botão pra desligar aqui como nas outras plataformas — o
    // webhook chega direto da RD Station, fora do controle do agendador do
    // ApontaAds. Sem essa checagem, desligar a chave não pausaria nada de
    // verdade nesta integração.
    const { data: integracao, error: erroIntegracao } = await supabaseAdmin
      .from('integrations')
      .select('account_id, is_active')
      .eq('id', integrationId)
      .maybeSingle();
    if (erroIntegracao) throw new Error(erroIntegracao.message);
    if (!integracao?.is_active) {
      return res.status(200).json({ ok: true, ignorado: true });
    }

    const { data: selecionados, error: erroSelecionados } = await supabaseAdmin
      .from('integration_selected_assets')
      .select('external_id')
      .eq('integration_id', integrationId);
    if (erroSelecionados) throw new Error(erroSelecionados.message);

    const selecionadoSet = new Set((selecionados ?? []).map((linha) => linha.external_id as string));
    if (!selecionadoSet.has(payload.event_identifier)) {
      // Ainda não selecionado — fica na fila de pendentes (não só a última
      // ocorrência) até o usuário selecionar o identificador; save-assets.ts
      // grava tudo o que estiver aqui na hora da seleção.
      const { error: erroPendente } = await supabaseAdmin.from('rd_station_pending_leads').insert({
        integration_id: integrationId,
        external_id: payload.event_identifier,
        payload: leadDoEvento,
      });
      if (erroPendente) {
        console.error('RD Station webhook: falha ao enfileirar lead pendente:', erroPendente.message);
      }
      return res.status(200).json({ ok: true, ignorado: true });
    }

    await normalizarEGravarLeads(supabaseAdmin, [leadDoEvento], integracao?.account_id ?? null);

    return res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('RD Station webhook: falha ao processar evento:', erro instanceof Error ? erro.message : erro);
    return res.status(200).json({ ok: true, erroInterno: true });
  }
}
