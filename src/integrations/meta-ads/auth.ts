import { lerCredenciais, salvarCredenciais } from '../credentialsVault.js';

export interface MetaAdsCredentials {
  accessToken: string; // longa duração, Business Manager
  adAccountId: string;
  appId?: string;
  appSecret?: string;
  accessTokenExpiresAt?: string;
}

export async function obterCredenciais(integrationId: string): Promise<MetaAdsCredentials> {
  const credenciais = await lerCredenciais<MetaAdsCredentials>(integrationId);
  if (!credenciais) throw new Error('Meta Ads: credenciais não configuradas');
  return credenciais;
}

/**
 * Troca o token de longa duração perto do vencimento (~60 dias). appId e
 * appSecret são obrigatórios para essa troca automática — sem eles, a
 * renovação só pode ser feita manualmente reconectando a integração.
 *
 * accessTokenExpiresAt não existe no formulário de credenciais — na primeira
 * conexão ele sempre vem vazio. "Não sei a validade" é tratado como "token
 * ainda válido" (acabou de ser colado pelo usuário), nunca como "precisa
 * renovar agora": só tentamos renovar quando SABEMOS que já venceu.
 */
export async function refreshCredentialsIfNeeded(integrationId: string): Promise<void> {
  const credenciais = await obterCredenciais(integrationId);

  const tokenExpirado =
    !!credenciais.accessTokenExpiresAt && new Date(credenciais.accessTokenExpiresAt) <= new Date();

  if (!tokenExpirado) return;

  if (!credenciais.appId || !credenciais.appSecret) {
    throw new Error('Meta Ads: token perto de expirar e appId/appSecret não configurados — reconecte a integração manualmente');
  }

  const parametros = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: credenciais.appId,
    client_secret: credenciais.appSecret,
    fb_exchange_token: credenciais.accessToken,
  });

  let resposta: Response;
  try {
    resposta = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${parametros}`, {
      signal: AbortSignal.timeout(20_000),
    });
  } catch (erro) {
    const foiTimeout = erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError');
    throw new Error(
      foiTimeout
        ? 'Meta Ads: renovação de token excedeu 20s sem resposta da API'
        : `Meta Ads: falha de rede ao renovar token — ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
    );
  }

  if (!resposta.ok) {
    throw new Error('Meta Ads: falha ao renovar o token de longa duração — reconecte a integração');
  }

  const dados = (await resposta.json()) as { access_token: string; expires_in?: number };

  // Token de usuário de sistema (Business Manager) não expira — a Meta devolve
  // a troca sem expires_in nesse caso. Sem essa informação, não fixamos uma
  // validade (accessTokenExpiresAt some): a próxima sincronização volta a
  // tratar o token como válido, em vez de gerar uma data inválida.
  await salvarCredenciais(integrationId, {
    ...credenciais,
    accessToken: dados.access_token,
    accessTokenExpiresAt: dados.expires_in ? new Date(Date.now() + dados.expires_in * 1000).toISOString() : undefined,
  });
}
