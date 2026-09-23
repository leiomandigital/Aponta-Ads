import type { IntegrationConnector, IntegrationKey } from './types.js';
import { googleAdsConnector } from './google-ads/index.js';
import { ga4Connector } from './ga4/index.js';
import { metaAdsConnector } from './meta-ads/index.js';
import { rdStationConnector } from './rd-station/index.js';

// Nenhuma tela ou rota de API conhece os detalhes de uma plataforma
// específica — tudo passa por aqui. dispatch.ts nunca importa nada de
// dentro das pastas de integração diretamente, só este registry.
const connectors: Record<IntegrationKey, IntegrationConnector> = {
  google_ads: googleAdsConnector,
  ga4: ga4Connector,
  meta_ads: metaAdsConnector,
  rd_station: rdStationConnector,
};

export function resolveConnector(key: IntegrationKey): IntegrationConnector {
  const connector = connectors[key];
  if (!connector) {
    throw new Error(`Nenhum conector registrado para a integração "${key}"`);
  }
  return connector;
}
