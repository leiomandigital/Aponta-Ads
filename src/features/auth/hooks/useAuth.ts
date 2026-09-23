import { useCallback, useState } from 'react';
import { useSession } from '@/lib/auth';
import { authService } from '../services/authService';

export function useAuth() {
  const { session, user, carregando } = useSession();
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const entrar = useCallback(async (email: string, senha: string) => {
    setEntrando(true);
    setErro(null);

    try {
      await authService.entrarComEmailSenha(email, senha);
    } catch (erroCapturado) {
      const mensagem = erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao entrar';
      setErro(mensagem);
      throw erroCapturado;
    } finally {
      setEntrando(false);
    }
  }, []);

  const sair = useCallback(async () => {
    await authService.sair();
  }, []);

  return {
    session,
    user,
    autenticado: !!session,
    carregandoSessao: carregando,
    entrando,
    erro,
    entrar,
    sair,
  };
}
