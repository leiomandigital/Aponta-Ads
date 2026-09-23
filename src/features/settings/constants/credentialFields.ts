export interface CampoCredencial {
  chave: string;
  rotulo: string;
  tipo: 'text' | 'password';
  obrigatorio: boolean;
}

// Confirme cada campo contra a documentação atual da respectiva plataforma
// antes de conectar de verdade — APIs mudam (ver Integration Connector Pattern Skill, seção 5).
export const CAMPOS_CREDENCIAL: Record<string, CampoCredencial[]> = {
  google_ads: [
    { chave: 'clientId', rotulo: 'Client ID', tipo: 'text', obrigatorio: true },
    { chave: 'clientSecret', rotulo: 'Client Secret', tipo: 'password', obrigatorio: true },
    { chave: 'refreshToken', rotulo: 'Refresh Token', tipo: 'password', obrigatorio: true },
    { chave: 'developerToken', rotulo: 'Developer Token', tipo: 'password', obrigatorio: true },
    { chave: 'customerId', rotulo: 'Customer ID (sem hífen)', tipo: 'text', obrigatorio: true },
  ],
  meta_ads: [
    { chave: 'accessToken', rotulo: 'Access Token (longa duração)', tipo: 'password', obrigatorio: true },
    { chave: 'adAccountId', rotulo: 'Ad Account ID', tipo: 'text', obrigatorio: true },
    { chave: 'appId', rotulo: 'App ID', tipo: 'text', obrigatorio: false },
    { chave: 'appSecret', rotulo: 'App Secret', tipo: 'password', obrigatorio: false },
  ],
  ga4: [
    { chave: 'serviceAccountJson', rotulo: 'Chave JSON da service account (conteúdo completo do arquivo)', tipo: 'password', obrigatorio: true },
    { chave: 'propertyId', rotulo: 'Property ID', tipo: 'text', obrigatorio: true },
  ],
  rd_station: [
    { chave: 'clientId', rotulo: 'Client ID', tipo: 'text', obrigatorio: true },
    { chave: 'clientSecret', rotulo: 'Client Secret', tipo: 'password', obrigatorio: true },
    { chave: 'refreshToken', rotulo: 'Refresh Token', tipo: 'password', obrigatorio: true },
  ],
};
