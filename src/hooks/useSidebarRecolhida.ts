import { useCallback, useEffect, useState } from 'react';

const CHAVE_PREFERENCIA = 'apontaads:sidebar-recolhida';

function lerPreferencia(): boolean {
  try {
    return localStorage.getItem(CHAVE_PREFERENCIA) === 'true';
  } catch {
    return false; // localStorage bloqueado: começa expandida
  }
}

/** Estado recolhido/expandido do menu lateral, lembrado entre páginas e visitas. */
export function useSidebarRecolhida() {
  const [recolhida, setRecolhida] = useState(lerPreferencia);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_PREFERENCIA, String(recolhida));
    } catch {
      // sem persistência: a preferência vale só até recarregar a página
    }
  }, [recolhida]);

  const alternar = useCallback(() => setRecolhida((atual) => !atual), []);

  return { recolhida, alternar };
}
