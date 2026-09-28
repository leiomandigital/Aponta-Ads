import type { IntegrationConnector, SyncResult } from '../types.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from './auth.js';

interface WebhookRD {
  uuid: string;
  status: string;
}

// RD Station Marketing não tem endpoint de "listar conversões por período" —
// os dados chegam em tempo real via webhook (/api/webhooks/rd-station), não
// por um pull do cron/"Sincronizar agora". sync() não busca lead nenhum, mas
// não é um no-op: é a checagem de saúde da integração. Sem isso, se o
// cliente revogar o acesso do app ou desativar a assinatura direto na RD
// Station, nada no ApontaAds detectaria isso sozinho (o webhook é passivo —
// só sabemos que parou se alguém notar a falta de leads). Rodando isso todo
// dia no cron, uma falha vira status 'error' + sync_logs, igual qualquer
// outra integração.
async function sync(integrationId: string): Promise<SyncResult> {
  const credenciais = await obterCredenciais(integrationId);

  if (!credenciais.webhookUuid) {
    return {
      status: 'error',
      recordsSynced: 0,
      errorMessage: 'RD Station: webhook nunca foi registrado — reconecte a integração',
    };
  }

  const resposta = await fetch('https://api.rd.services/integrations/webhooks', {
    headers: { Authorization: `Bearer ${credenciais.accessToken}` },
  });

  if (!resposta.ok) {
    const corpoErro = await resposta.text().catch(() => '');
    return {
      status: 'error',
      recordsSynced: 0,
      errorMessage: `RD Station: falha ao verificar o webhook (HTTP ${resposta.status}) ${corpoErro}`,
    };
  }

  const dados = (await resposta.json()) as { webhooks?: WebhookRD[] };
  const assinatura = (dados.webhooks ?? []).find((webhook) => webhook.uuid === credenciais.webhookUuid);

  if (!assinatura) {
    return {
      status: 'error',
      recordsSynced: 0,
      errorMessage: 'RD Station: a assinatura do webhook não existe mais na conta do cliente (revogada?) — reconecte a integração',
    };
  }

  if (assinatura.status !== 'active') {
    return {
      status: 'error',
      recordsSynced: 0,
      errorMessage: `RD Station: assinatura do webhook está com status "${assinatura.status}", não "active" — reconecte a integração`,
    };
  }

  return {
    status: 'success',
    recordsSynced: 0,
    details: { rdStation: 'webhook ativo — leads chegam automaticamente por evento' },
  };
}

export const rdStationConnector: IntegrationConnector = {
  key: 'rd_station',
  refreshCredentialsIfNeeded,
  sync,
};
