import { lerCredenciais } from '../credentialsVault.js';

export interface GoogleAdsCredentials {
  sheetsUrl: string;
  customerId?: string; // sem hífen — filtra as linhas da planilha quando ela reúne mais de uma conta
}

export async function obterCredenciais(integrationId: string): Promise<GoogleAdsCredentials> {
  const credenciais = await lerCredenciais<GoogleAdsCredentials>(integrationId);
  if (!credenciais) throw new Error('Google Ads: credenciais não configuradas');
  return credenciais;
}

/**
 * Não há token a renovar neste fluxo — os dados chegam via Google Ads Script
 * escrevendo numa planilha pública (sem OAuth). Mantido como no-op só para
 * satisfazer o contrato IntegrationConnector.
 */
export async function refreshCredentialsIfNeeded(_integrationId: string): Promise<void> {}
