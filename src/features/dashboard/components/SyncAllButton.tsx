import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncAllButtonProps {
  sincronizando: boolean;
  desabilitado: boolean;
  aoClicar: () => void;
}

/** Sincroniza todas as integrações ativas de uma vez, sem precisar ir em Configurações. */
export function SyncAllButton({ sincronizando, desabilitado, aoClicar }: SyncAllButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={aoClicar}
      disabled={desabilitado || sincronizando}
      title={desabilitado ? 'Nenhuma integração ativa para sincronizar' : 'Sincronizar dados de todas as integrações ativas'}
    >
      {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      <span className="sr-only">{sincronizando ? 'Sincronizando...' : 'Sincronizar dados'}</span>
    </Button>
  );
}
