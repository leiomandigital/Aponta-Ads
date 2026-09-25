import { useCallback, useEffect, useState } from 'react';
import { integrationsService } from '../services/integrationsService';

/**
 * Visão global (todas as contas) usada só pelo botão "Sincronizar tudo" do
 * dashboard e pelo aviso de "nenhuma integração conectada" — não é escopado
 * por conta. Para a tela de Configurações (por conta), ver useIntegrations.ts.
 */
export function useGlobalSyncStatus() {
  const [algumaIntegracaoAtiva, setAlgumaIntegracaoAtiva] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sincronizandoTodas, setSincronizandoTodas] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const integracoes = await integrationsService.listarTodas();
      setAlgumaIntegracaoAtiva(integracoes.some((integracao) => integracao.is_active));
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar integrações');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const sincronizarTodas = useCallback(async () => {
    setSincronizandoTodas(true);
    setErro(null);
    try {
      const resultados = await integrationsService.sincronizarTodas();
      await buscar();

      const falhas = resultados.filter((resultado) => resultado.status === 'error');
      if (falhas.length > 0) {
        throw new Error(`Falha ao sincronizar: ${falhas.map((falha) => falha.integration).join(', ')}`);
      }
    } catch (erroCapturado) {
      const mensagem = erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao sincronizar as integrações';
      setErro(mensagem);
      throw erroCapturado;
    } finally {
      setSincronizandoTodas(false);
    }
  }, [buscar]);

  return { algumaIntegracaoAtiva, carregando, erro, sincronizandoTodas, sincronizarTodas, recarregar: buscar };
}
