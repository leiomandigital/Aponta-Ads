import { lerCredenciais, salvarCredenciais } from '../credentialsVault.js';

// A RD Station Marketing API usa OAuth2 (access_token de curta duração,
// 24h, + refresh_token) — confirmado contra a doc oficial (developers.rdstation.com).
export interface RDStationCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  /** Segredo aleatório embutido na URL do webhook (query string) — a RD
   * Station não assina o payload nem aceita headers customizados na
   * assinatura, então isso é o único jeito de validar que uma chamada em
   * /api/webhooks/rd-station é legítima. Gerado uma vez, em registrarWebhookSeNecessario. */
  webhookSecret?: string;
  /** uuid da assinatura de webhook já criada na RD Station — presente = não
   * registra de novo (a API rejeita URL duplicada pro mesmo event_type). */
  webhookUuid?: string;
}

export async function obterCredenciais(integrationId: string): Promise<RDStationCredentials> {
  const credenciais = await lerCredenciais<RDStationCredentials>(integrationId);
  if (!credenciais) throw new Error('RD Station: credenciais não configuradas');
  return credenciais;
}

export async function refreshCredentialsIfNeeded(integrationId: string): Promise<void> {
  const credenciais = await obterCredenciais(integrationId);

  const tokenValido =
    credenciais.accessToken &&
    credenciais.accessTokenExpiresAt &&
    new Date(credenciais.accessTokenExpiresAt) > new Date();

  if (tokenValido) return;

  // A doc oficial ("Como utilizar o refresh_token...") mostra o body como só
  // grant_type+refresh_token, mas a API real rejeita isso com
  // CANNOT_BE_NULL em client_id/client_secret (confirmado testando contra
  // conta real) — a doc está incompleta aqui. Body real precisa dos 4 campos.
  const resposta = await fetch('https://api.rd.services/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&client_id=${encodeURIComponent(credenciais.clientId)}&client_secret=${encodeURIComponent(credenciais.clientSecret)}&refresh_token=${encodeURIComponent(credenciais.refreshToken)}`,
  });

  if (!resposta.ok) {
    const corpoErro = await resposta.text().catch(() => '');
    throw new Error(`RD Station: falha ao renovar o token OAuth2 (HTTP ${resposta.status}) ${corpoErro} — reconecte a integração`);
  }

  const dados = (await resposta.json()) as { access_token: string; expires_in: number; refresh_token: string };

  // A API devolve um refresh_token novo a cada renovação (rotação) — precisa
  // persistir o novo, senão a próxima renovação usa um valor já invalidado.
  await salvarCredenciais(integrationId, {
    ...credenciais,
    accessToken: dados.access_token,
    accessTokenExpiresAt: new Date(Date.now() + dados.expires_in * 1000).toISOString(),
    refreshToken: dados.refresh_token,
  });
}
