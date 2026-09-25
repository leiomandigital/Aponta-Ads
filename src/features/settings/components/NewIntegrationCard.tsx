import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CredentialsDialog } from './CredentialsDialog';
import type { IntegrationKey } from '@/types/database.types';

interface NewIntegrationCardProps {
  integrationKey: IntegrationKey;
  integrationName: string;
  accountId: string;
  aoRecarregar: () => Promise<void>;
}

/** Plataforma ainda sem nenhuma linha (própria ou compartilhada) visível para esta conta. */
export function NewIntegrationCard({ integrationKey, integrationName, accountId, aoRecarregar }: NewIntegrationCardProps) {
  const [dialogoAberto, setDialogoAberto] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">{integrationName}</span>
          <Badge variant="secondary">Desconectado</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialogoAberto(true)}>
          Conectar
        </Button>
      </CardContent>

      <CredentialsDialog
        integrationKey={integrationKey}
        integrationName={integrationName}
        accountId={accountId}
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        aoSalvarComSucesso={aoRecarregar}
      />
    </Card>
  );
}
