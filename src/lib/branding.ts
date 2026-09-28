import { createContext, useContext } from 'react';

/** Usado sempre que system_name não está configurado em dashboard_settings. */
export const NOME_PADRAO_SISTEMA = 'ApontaAds';

export interface BrandingContextValue {
  /** Nome de apresentação já com o fallback aplicado — nunca vazio. */
  nome: string;
  logoUrl: string | null;
  carregando: boolean;
}

export const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export function useBranding(): BrandingContextValue {
  const contexto = useContext(BrandingContext);
  if (!contexto) {
    throw new Error('useBranding precisa ser usado dentro de um BrandingProvider');
  }
  return contexto;
}
