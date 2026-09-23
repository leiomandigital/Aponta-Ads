import { useCallback, useEffect, useState } from 'react';
import { integrationsService } from '../services/integrationsService';
import type { Integration } from '@/types/database.types';

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sincronizandoKey, setSincronizandoKey] = useState<string | null>(null);
  const [sincronizandoTodas, setSincronizandoTodas] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await integrationsService.listarTodas();
      setIntegrations(dados);
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar integrações');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const alternarAtiva = useCallback(
    async (key: Integration['key'], isActive: boolean) => {
      try {
        await integrationsService.ativarDesativar(key, isActive);
        setIntegrations((anteriores) => anteriores.map((item) => (item.key === key ? { ...item, is_active: isActive } : item)));
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao atualizar integração');
      }
    },
    []
  );

  const sincronizarAgora = useCallback(async (key: Integration['key']) => {
    setSincronizandoKey(key);
    setErro(null);
    try {
      await integrationsService.sincronizarAgora(key);
      await buscar();
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : `Erro ao sincronizar ${key}`);
    } finally {
      setSincronizandoKey(null);
    }
  }, [buscar]);

  /**
   * Sincroniza todas as integrações ativas de uma vez (botão do dashboard).
   * Lança um erro resumindo quais falharam quando pelo menos uma não deu
   * 'success' — quem chama decide como exibir (o card de status de cada uma
   * já reflete o resultado depois do `buscar()`).
   */
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

  return {
    integrations,
    carregando,
    erro,
    sincronizandoKey,
    sincronizandoTodas,
    alternarAtiva,
    sincronizarAgora,
    sincronizarTodas,
    recarregar: buscar,
    algumaIntegracaoAtiva: integrations.some((item) => item.is_active),
  };
}
