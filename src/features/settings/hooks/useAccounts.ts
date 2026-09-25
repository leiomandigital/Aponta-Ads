import { useCallback, useEffect, useState } from 'react';
import { accountsService } from '../services/accountsService';
import type { Account } from '@/types/database.types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [idsComIntegracao, setIdsComIntegracao] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaContas, listaIdsComIntegracao] = await Promise.all([
        accountsService.listar(),
        accountsService.listarIdsComIntegracao(),
      ]);
      setAccounts(listaContas);
      setIdsComIntegracao(listaIdsComIntegracao);
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar contas');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const criar = useCallback(
    async (name: string) => {
      setSalvando(true);
      setErro(null);
      try {
        const nova = await accountsService.criar(name);
        await buscar();
        return nova;
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao criar conta');
        return null;
      } finally {
        setSalvando(false);
      }
    },
    [buscar]
  );

  const renomear = useCallback(
    async (id: string, name: string) => {
      setSalvando(true);
      setErro(null);
      try {
        await accountsService.renomear(id, name);
        await buscar();
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao renomear conta');
      } finally {
        setSalvando(false);
      }
    },
    [buscar]
  );

  const ativarDesativar = useCallback(
    async (id: string, isActive: boolean) => {
      setSalvando(true);
      setErro(null);
      try {
        await accountsService.ativarDesativar(id, isActive);
        await buscar();
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao alterar a conta');
      } finally {
        setSalvando(false);
      }
    },
    [buscar]
  );

  /** Só funciona de verdade se a conta nunca teve integração (o banco garante) — ver accountsService.excluir. */
  const excluir = useCallback(
    async (id: string) => {
      setSalvando(true);
      setErro(null);
      try {
        await accountsService.excluir(id);
        await buscar();
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao excluir conta');
      } finally {
        setSalvando(false);
      }
    },
    [buscar]
  );

  return { accounts, idsComIntegracao, carregando, salvando, erro, criar, renomear, ativarDesativar, excluir, recarregar: buscar };
}
