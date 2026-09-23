import { lerCredenciais, salvarCredenciais } from '../credentialsVault.js';

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  customerId: string; // sem hífen
  accessToken?: string;
  accessTokenExpiresAt?: string;
}

export async function obterCredenciais(): Promise<GoogleAdsCredentials> {
  const credenciais = await lerCredenciais<GoogleAdsCredentials>('google_ads');
  if (!credenciais) throw new Error('Google Ads: credenciais não configuradas');
  return credenciais;
}

/**
 * Renova o access token perto de expirar. Roda sempre antes de sync() — o
 * token de vida limitada do Google Ads pode ter expirado entre um ciclo do
 * cron e o outro, e assumir isso é mais barato que descobrir no meio da chamada.
 */
export async function refreshCredentialsIfNeeded(): Promise<void> {
  const credenciais = await obterCredenciais();

  const tokenValido =
    credenciais.accessToken &&
    credenciais.accessTokenExpiresAt &&
    new Date(credenciais.accessTokenExpiresAt) > new Date();

  if (tokenValido) return;

  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credenciais.clientId,
      client_secret: credenciais.clientSecret,
      refresh_token: credenciais.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!resposta.ok) {
    throw new Error('Google Ads: falha ao renovar o token OAuth2 — reconecte a integração');
  }

  const dados = (await resposta.json()) as { access_token: string; expires_in: number };

  await salvarCredenciais('google_ads', {
    ...credenciais,
    accessToken: dados.access_token,
    accessTokenExpiresAt: new Date(Date.now() + dados.expires_in * 1000).toISOString(),
  });
}
