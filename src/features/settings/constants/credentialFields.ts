export interface CampoCredencial {
  chave: string;
  rotulo: string;
  tipo: 'text' | 'password';
  obrigatorio: boolean;
}

// Confirme cada campo contra a documentação atual da respectiva plataforma
// antes de conectar de verdade — APIs mudam (ver Integration Connector Pattern Skill, seção 5).
export const CAMPOS_CREDENCIAL: Record<string, CampoCredencial[]> = {
  // customerId não entra aqui de propósito: depois de salvar a URL da
  // planilha, a tela mostra o Google Ads Script pra colar e, na sequência, a
  // seleção de conta (AssetSelectionDialog) — ver GoogleAdsScriptPanel.
  google_ads: [
    { chave: 'sheetsUrl', rotulo: 'URL da planilha do Google Sheets', tipo: 'text', obrigatorio: true },
  ],
  meta_ads: [
    { chave: 'accessToken', rotulo: 'Access Token (longa duração)', tipo: 'password', obrigatorio: true },
    { chave: 'adAccountId', rotulo: 'Ad Account ID', tipo: 'text', obrigatorio: true },
    { chave: 'appId', rotulo: 'App ID', tipo: 'text', obrigatorio: false },
    { chave: 'appSecret', rotulo: 'App Secret', tipo: 'password', obrigatorio: false },
  ],
  // propertyId não entra aqui de propósito: depois de salvar a chave da
  // service account, a tela abre a seleção de ativos (AssetSelectionDialog),
  // que lista as propriedades reais via API em vez de pedir o ID de cor.
  ga4: [
    { chave: 'serviceAccountJson', rotulo: 'Chave JSON da service account (conteúdo completo do arquivo)', tipo: 'password', obrigatorio: true },
  ],
  rd_station: [
    { chave: 'clientId', rotulo: 'Client ID', tipo: 'text', obrigatorio: true },
    { chave: 'clientSecret', rotulo: 'Client Secret', tipo: 'password', obrigatorio: true },
    { chave: 'refreshToken', rotulo: 'Refresh Token', tipo: 'password', obrigatorio: true },
  ],
};
