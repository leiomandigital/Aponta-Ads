import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type Tema } from '@/lib/theme';

const CHAVE_ARMAZENAMENTO = 'apontaads-theme';

function lerTemaSalvo(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (salvo === 'light' || salvo === 'dark' || salvo === 'system') return salvo;
  } catch {
    // localStorage indisponível (navegação privada, etc.) — usa o padrão
  }
  // Padrão do sistema é claro — o cliente muda para "Automático" ou "Escuro"
  // manualmente no seletor de tema, se quiser.
  return 'light';
}

function sistemaPrefereDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [tema, setTema] = useState<Tema>(lerTemaSalvo);
  const [prefereDarkNoSistema, setPrefereDarkNoSistema] = useState(sistemaPrefereDark);

  // Acompanha a configuração da máquina em tempo real quando o usuário não
  // escolheu explicitamente claro/escuro (tema === 'system').
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (evento: MediaQueryListEvent) => setPrefereDarkNoSistema(evento.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const temaEfetivo = tema === 'system' ? (prefereDarkNoSistema ? 'dark' : 'light') : tema;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', temaEfetivo === 'dark');
  }, [temaEfetivo]);

  const definirTema = (novoTema: Tema) => {
    setTema(novoTema);
    try {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, novoTema);
    } catch {
      // preferência não persiste nesta sessão, mas continua aplicada em memória
    }
  };

  const valor = useMemo(() => ({ tema, temaEfetivo, definirTema }), [tema, temaEfetivo]);

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}
