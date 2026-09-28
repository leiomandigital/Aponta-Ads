import { randomUUID } from 'node:crypto';
import { salvarCredenciais } from '../credentialsVault.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from './auth.js';

interface RespostaCriacaoWebhook {
  uuid: string;
}

/**
 * Registra a assinatura de webhook WEBHOOK.CONVERTED na conta RD Station do
 * cliente, apontando para /api/webhooks/rd-station — existe porque a API do
 * RD Station Marketing não tem um jeito de CONSULTAR conversões por período
 * (só de receber em tempo real via webhook; ver decisão de arquitetura no
 * histórico da integração). Chamado a cada save-credentials de uma
 * integração rd_station; idempotente — se webhookUuid já existir, não faz
 * nada (a RD Station rejeita cadastrar URL duplicada pro mesmo event_type).
 *
 * PUBLIC_APP_URL precisa apontar para o domínio real publicado (a RD Station
 * faz uma chamada de validação nessa URL ao criar a assinatura e exige 2xx)
 * — só funciona contra o deploy de produção, nunca localhost.
 */
export async function registrarWebhookSeNecessario(integrationId: string): Promise<void> {
  const credenciaisAtuais = await obterCredenciais(integrationId);
  if (credenciaisAtuais.webhookUuid) return;

  const baseUrl = process.env.PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error('RD Station: variável de ambiente PUBLIC_APP_URL não configurada — necessária para registrar o webhook');
  }

  await refreshCredentialsIfNeeded(integrationId);
  const credenciaisComToken = await obterCredenciais(integrationId);

  const webhookSecret = randomUUID();
  const urlWebhook = `${baseUrl.replace(/\/$/, '')}/api/webhooks/rd-station?integrationId=${integrationId}&secret=${webhookSecret}`;

  const resposta = await fetch('https://api.rd.services/integrations/webhooks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credenciaisComToken.accessToken}`,
    },
    body: JSON.stringify({
      event_type: 'WEBHOOK.CONVERTED',
      entity_type: 'CONTACT',
      url: urlWebhook,
      http_method: 'POST',
    }),
  });

  if (!resposta.ok) {
    const corpoErro = await resposta.text().catch(() => '');
    throw new Error(`RD Station: falha ao registrar o webhook (HTTP ${resposta.status}) ${corpoErro}`);
  }

  const dados = (await resposta.json()) as RespostaCriacaoWebhook;

  await salvarCredenciais(integrationId, {
    ...credenciaisComToken,
    webhookSecret,
    webhookUuid: dados.uuid,
  });
}
