import { lerCredenciais, salvarCredenciais } from '../credentialsVault.js';

// A RD Station Marketing API usa OAuth2 (access_token de curta duração +
// refresh_token). CONFIRME contra a documentação atual antes de implementar
// de verdade — pode ter mudado para token direto (Bearer) em algum plano.
export interface RDStationCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
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

  const resposta = await fetch('https://api.rd.services/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: credenciais.clientId,
      client_secret: credenciais.clientSecret,
      refresh_token: credenciais.refreshToken,
    }),
  });

  if (!resposta.ok) {
    throw new Error('RD Station: falha ao renovar o token OAuth2 — reconecte a integração');
  }

  const dados = (await resposta.json()) as { access_token: string; expires_in: number };

  await salvarCredenciais(integrationId, {
    ...credenciais,
    accessToken: dados.access_token,
    accessTokenExpiresAt: new Date(Date.now() + dados.expires_in * 1000).toISOString(),
  });
}
