import { lerCredenciais, salvarCredenciais } from '../credentialsVault.js';

export interface GA4Credentials {
  /** Conteúdo completo do arquivo JSON de chave da service account. */
  serviceAccountJson: string;
  /** Preenchido pela tela de seleção de ativos, depois da credencial salva — ver AssetSelectionDialog. */
  propertyId?: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
}

interface ChaveServiceAccount {
  client_email: string;
  private_key: string;
}

const ESCOPO_GA4 = 'https://www.googleapis.com/auth/analytics.readonly';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';

export async function obterCredenciais(integrationId: string): Promise<GA4Credentials> {
  const credenciais = await lerCredenciais<GA4Credentials>(integrationId);
  if (!credenciais) throw new Error('GA4: credenciais não configuradas');
  return credenciais;
}

function lerChave(serviceAccountJson: string): ChaveServiceAccount {
  let chave: Partial<ChaveServiceAccount>;
  try {
    chave = JSON.parse(serviceAccountJson) as Partial<ChaveServiceAccount>;
  } catch {
    throw new Error('GA4: chave JSON da service account inválida — cole o conteúdo completo do arquivo');
  }

  if (!chave.client_email || !chave.private_key) {
    throw new Error('GA4: chave JSON sem client_email ou private_key — confira se é o arquivo da service account');
  }
  return { client_email: chave.client_email, private_key: chave.private_key };
}

function base64Url(dados: string | Uint8Array): string {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : dados;
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemParaBytes(pem: string): Uint8Array<ArrayBuffer> {
  const base64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let indice = 0; indice < binario.length; indice++) bytes[indice] = binario.charCodeAt(indice);
  return bytes;
}

/** JWT assinado (RS256) que a service account troca por um access token — fluxo "JWT bearer" do Google. */
async function assinarJwt(chave: ChaveServiceAccount): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = base64Url(
    JSON.stringify({ iss: chave.client_email, scope: ESCOPO_GA4, aud: URL_TOKEN, iat: agora, exp: agora + 3600 })
  );

  const chavePrivada = await crypto.subtle.importKey(
    'pkcs8',
    pemParaBytes(chave.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const assinatura = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    chavePrivada,
    new TextEncoder().encode(`${cabecalho}.${corpo}`)
  );

  return `${cabecalho}.${corpo}.${base64Url(new Uint8Array(assinatura))}`;
}

export async function refreshCredentialsIfNeeded(integrationId: string): Promise<void> {
  const credenciais = await obterCredenciais(integrationId);

  const tokenValido =
    credenciais.accessToken &&
    credenciais.accessTokenExpiresAt &&
    new Date(credenciais.accessTokenExpiresAt) > new Date();

  if (tokenValido) return;

  const jwt = await assinarJwt(lerChave(credenciais.serviceAccountJson));

  const resposta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!resposta.ok) {
    throw new Error('GA4: falha ao obter token da service account — confira a chave JSON e reconecte a integração');
  }

  const dados = (await resposta.json()) as { access_token: string; expires_in: number };

  await salvarCredenciais(integrationId, {
    ...credenciais,
    accessToken: dados.access_token,
    accessTokenExpiresAt: new Date(Date.now() + dados.expires_in * 1000).toISOString(),
  });
}
