import { useCallback, useEffect, useState } from 'react';
import { integrationsService } from '@/features/settings/services/integrationsService';
import type { DashboardSettings } from '@/types/database.types';

/**
 * Leitura compartilhada de dashboard_settings — usada tanto pela sidebar
 * (exibir a logo do cliente) quanto pela tela de Configurações (editar
 * marca). Mutação (upload de logo, cor) fica em useBrandSettings.
 */
export function useDashboardSettings() {
  const [configuracoes, setConfiguracoes] = useState<DashboardSettings | null>(null);
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await integrationsService.obterConfiguracoesDoDashboard();
      setConfiguracoes(dados);
    } catch {
      setConfiguracoes(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  return { configuracoes, carregando, recarregar: buscar };
}
