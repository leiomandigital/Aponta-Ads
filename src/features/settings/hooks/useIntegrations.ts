import { useCallback, useEffect, useMemo, useState } from 'react';
import { integrationsService } from '../services/integrationsService';
import type { Integration } from '@/types/database.types';

// Mesmo catálogo fixo de plataformas da migration 001 — usado só para saber
// quais das 4 ainda não têm nenhuma linha visível (própria ou compartilhada)
// para a conta selecionada, e mostrar um cartão de "Conectar" pra elas.
const CATALOGO_PLATAFORMAS: Array<{ key: Integration['key']; name: string }> = [
  { key: 'google_ads', name: 'Google Ads' },
  { key: 'ga4', name: 'Google Analytics 4' },
  { key: 'meta_ads', name: 'Meta Ads' },
  { key: 'rd_station', name: 'RD Station' },
];

/**
 * Escopado a UMA conta — usado pela tela de Configurações. Para o botão
 * global "sincronizar tudo" do dashboard (que não pertence a conta nenhuma),
 * ver useGlobalSyncStatus.ts.
 */
export function useIntegrations(accountId: string) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null);
  const [sincronizandoTodas, setSincronizandoTodas] = useState(false);

  const buscar = useCallback(async () => {
    // accountId vazio = a tela ainda está esperando a lista de contas carregar
    // (SettingsIntegrationsPage passa '' até ter uma conta selecionada) — não
    // há o que buscar ainda.
    if (!accountId) return;
    setCarregando(true);
    setErro(null);
    try {
      const dados = await integrationsService.listarPorConta(accountId);
      setIntegrations(dados);
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar integrações');
    } finally {
      setCarregando(false);
    }
  }, [accountId]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  // "Desconectada" conta como "não existe" pra fins de exibição, mesmo quando
  // já existe uma linha no banco (ex: contas antigas herdaram, da migration
  // 026, linhas seedadas desde sempre pra plataformas nunca conectadas) — sem
  // isso, contas antigas mostrariam switch/checkbox de compartilhamento numa
  // integração que nunca funcionou, mostrar diferente do que uma conta nova
  // mostra pro mesmo estado "nunca conectei isso". Ao clicar "Conectar" numa
  // dessas, o save-credentials.ts reaproveita a linha existente (mesma key +
  // conta), não cria duplicata.
  const integracoesConectadas = useMemo(
    () => integrations.filter((integracao) => integracao.status !== 'disconnected'),
    [integrations]
  );

  const faltantes = useMemo(() => {
    const chavesConectadas = new Set(integracoesConectadas.map((integracao) => integracao.key));
    return CATALOGO_PLATAFORMAS.filter((plataforma) => !chavesConectadas.has(plataforma.key));
  }, [integracoesConectadas]);

  const alternarAtiva = useCallback(async (id: string, isActive: boolean) => {
    try {
      await integrationsService.ativarDesativar(id, isActive);
      setIntegrations((anteriores) => anteriores.map((item) => (item.id === id ? { ...item, is_active: isActive } : item)));
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao atualizar integração');
    }
  }, []);

  const alternarCompartilhamento = useCallback(
    async (id: string, novoAccountId: string | null) => {
      try {
        await integrationsService.alternarCompartilhamento(id, novoAccountId, accountId);
        await buscar();
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao alterar compartilhamento');
      }
    },
    [buscar, accountId]
  );

  const sincronizarAgora = useCallback(
    async (id: string) => {
      setSincronizandoId(id);
      setErro(null);
      try {
        await integrationsService.sincronizarAgora(id);
        await buscar();
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao sincronizar');
      } finally {
        setSincronizandoId(null);
      }
    },
    [buscar]
  );

  /**
   * Sincroniza todas as integrações ativas de uma vez (botão do dashboard,
   * de todas as contas). Lança um erro resumindo quais falharam quando pelo
   * menos uma não deu 'success' — quem chama decide como exibir (o card de
   * status de cada uma já reflete o resultado depois do `buscar()`).
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
    integrations: integracoesConectadas,
    faltantes,
    carregando,
    erro,
    sincronizandoId,
    sincronizandoTodas,
    alternarAtiva,
    alternarCompartilhamento,
    sincronizarAgora,
    sincronizarTodas,
    recarregar: buscar,
    algumaIntegracaoAtiva: integrations.some((item) => item.is_active),
  };
}
