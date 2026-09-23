import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface SessionContextValue {
  session: Session | null;
  user: User | null;
  carregando: boolean;
}

export const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession(): SessionContextValue {
  const contexto = useContext(SessionContext);
  if (!contexto) {
    throw new Error('useSession precisa ser usado dentro de um SessionProvider');
  }
  return contexto;
}
