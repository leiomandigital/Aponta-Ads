import { createContext, useContext } from 'react';

export type Tema = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  tema: Tema;
  temaEfetivo: 'light' | 'dark';
  definirTema: (tema: Tema) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const contexto = useContext(ThemeContext);
  if (!contexto) {
    throw new Error('useTheme precisa ser usado dentro de um ThemeProvider');
  }
  return contexto;
}
