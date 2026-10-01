import { useCallback, useEffect, useState } from 'react';
import { costEntriesService, type DadosLancamentoDeCusto } from '../services/costEntriesService';
import type { CampaignCostEntry } from '@/types/database.types';

export function useCostEntries(accountId: string) {
  const [entradas, setEntradas] = useState<CampaignCostEntry[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    if (!accountId) return;
    setCarregando(true);
    setErro(null);
    try {
      setEntradas(await costEntriesService.listarPorConta(accountId));
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar lançamentos de custo');
    } finally {
      setCarregando(false);
    }
  }, [accountId]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const criar = useCallback(
    async (dados: DadosLancamentoDeCusto) => {
      setSalvando(true);
      setErro(null);
      try {
        await costEntriesService.criar(dados);
        await buscar();
        return true;
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao lançar custo');
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [buscar]
  );

  const atualizar = useCallback(
    async (id: string, dados: DadosLancamentoDeCusto) => {
      setSalvando(true);
      setErro(null);
      try {
        await costEntriesService.atualizar(id, dados);
        await buscar();
        return true;
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao salvar lançamento');
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [buscar]
  );

  const excluir = useCallback(
    async (id: string) => {
      setSalvando(true);
      setErro(null);
      try {
        await costEntriesService.excluir(id);
        await buscar();
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao excluir lançamento');
      } finally {
        setSalvando(false);
      }
    },
    [buscar]
  );

  return { entradas, carregando, salvando, erro, criar, atualizar, excluir, recarregar: buscar };
}
