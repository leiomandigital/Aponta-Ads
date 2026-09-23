import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { CredentialsDialog } from './CredentialsDialog';
import { formatarDataHora } from '@/utils/formatters';
import type { Integration, IntegrationStatus } from '@/types/database.types';

const ROTULO_STATUS: Record<IntegrationStatus, { texto: string; variante: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  connected: { texto: 'Conectado', variante: 'success' },
  error: { texto: 'Erro', variante: 'destructive' },
  pending: { texto: 'Pendente', variante: 'warning' },
  disconnected: { texto: 'Desconectado', variante: 'secondary' },
};

interface IntegrationCardProps {
  integration: Integration;
  sincronizando: boolean;
  aoAlternarAtiva: (isActive: boolean) => void;
  aoSincronizarAgora: () => void;
  aoRecarregar: () => Promise<void>;
}

export function IntegrationCard({ integration, sincronizando, aoAlternarAtiva, aoSincronizarAgora, aoRecarregar }: IntegrationCardProps) {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const status = ROTULO_STATUS[integration.status];

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{integration.name}</span>
            <Badge variant={status.variante}>{status.texto}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {integration.last_synced_at
              ? `Última sincronização: ${formatarDataHora(integration.last_synced_at)}`
              : 'Nunca sincronizado'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {integration.status !== 'disconnected' && (
            <Button variant="ghost" size="icon" onClick={aoSincronizarAgora} disabled={sincronizando} title="Sincronizar agora">
              {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          )}
          <Switch checked={integration.is_active} onCheckedChange={aoAlternarAtiva} />
          <Button variant="outline" size="sm" onClick={() => setDialogoAberto(true)}>
            {integration.status === 'disconnected' ? 'Conectar' : 'Reconectar'}
          </Button>
        </div>
      </CardContent>

      <CredentialsDialog
        integration={integration}
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        aoSalvarComSucesso={aoRecarregar}
      />
    </Card>
  );
}
