import { useEffect, useMemo, type ReactNode } from 'react';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { BrandingContext, NOME_PADRAO_SISTEMA } from '@/lib/branding';

interface BrandingProviderProps {
  children: ReactNode;
}

/**
 * Nome/logo do cliente (Configurações → Marca) aplicados a tudo que hoje
 * mostra "ApontaAds" fixo fora do PDF (que busca direto no servidor, ver
 * api/export/pdf.ts): menu (AppSidebar), tela de login e aba do navegador.
 * dashboard_settings tem leitura pública (migration 042), então isso
 * funciona mesmo antes do login.
 */
export function BrandingProvider({ children }: BrandingProviderProps) {
  const { configuracoes, carregando } = useDashboardSettings();

  const nome = configuracoes?.system_name?.trim() || NOME_PADRAO_SISTEMA;
  const logoUrl = configuracoes?.client_logo_url ?? null;

  useEffect(() => {
    document.title = nome;

    // Nome usado pelo iOS ao "Adicionar à Tela de Início" — lido do DOM no
    // momento do toque em compartilhar, não buscado separadamente, então dá
    // pra atualizar em tempo de execução (ver index.html para o valor padrão).
    const metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (metaAppleTitle) metaAppleTitle.setAttribute('content', nome);
  }, [nome]);

  const valor = useMemo(() => ({ nome, logoUrl, carregando }), [nome, logoUrl, carregando]);

  return <BrandingContext.Provider value={valor}>{children}</BrandingContext.Provider>;
}
