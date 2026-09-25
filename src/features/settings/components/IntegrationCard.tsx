import { useState } from 'react';
import { Loader2, RefreshCw, ListChecks, History, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { CredentialsDialog } from './CredentialsDialog';
import { AssetSelectionDialog } from './AssetSelectionDialog';
import { SyncHistoryDialog } from './SyncHistoryDialog';
import { formatarDataHora } from '@/utils/formatters';
import type { Integration, IntegrationStatus } from '@/types/database.types';

const ROTULO_STATUS: Record<IntegrationStatus, { texto: string; variante: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  connected: { texto: 'Conectado', variante: 'success' },
  error: { texto: 'Erro', variante: 'destructive' },
  pending: { texto: 'Pendente', variante: 'warning' },
  disconnected: { texto: 'Desconectado', variante: 'secondary' },
};

const PLATAFORMAS_COM_SELECAO_DE_ATIVOS = ['ga4', 'rd_station'];

interface IntegrationCardProps {
  integration: Integration;
  /** Conta a partir de onde a tela está sendo vista — usada só se o usuário desmarcar "compartilhada". */
  accountId: string;
  sincronizando: boolean;
  aoAlternarAtiva: (isActive: boolean) => void;
  aoAlternarCompartilhamento: (novoAccountId: string | null) => void;
  aoSincronizarAgora: () => void;
  aoRecarregar: () => Promise<void>;
}

export function IntegrationCard({
  integration,
  accountId,
  sincronizando,
  aoAlternarAtiva,
  aoAlternarCompartilhamento,
  aoSincronizarAgora,
  aoRecarregar,
}: IntegrationCardProps) {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [dialogoAtivosAberto, setDialogoAtivosAberto] = useState(false);
  const [dialogoHistoricoAberto, setDialogoHistoricoAberto] = useState(false);
  const status = ROTULO_STATUS[integration.status];
  const compartilhada = integration.account_id === null;
  // Só a conta que marcou como compartilhada pode desmarcar — nas demais o
  // controle fica visível (mostra que é compartilhada) mas travado. Quando
  // shared_from_account_id vier nulo (linha antiga, de antes desse campo
  // existir), não trava ninguém — sem isso a integração ficaria presa como
  // compartilhada pra sempre, sem dono nenhum que possa desmarcar.
  const podeAlterarCompartilhamento =
    !compartilhada || integration.shared_from_account_id === null || integration.shared_from_account_id === accountId;
  const temSelecaoDeAtivos = PLATAFORMAS_COM_SELECAO_DE_ATIVOS.includes(integration.key);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{integration.name}</span>
            <Badge variant={status.variante}>{status.texto}</Badge>
            {compartilhada && <Badge variant="secondary">Compartilhada</Badge>}
          </div>
          <span className="text-xs text-muted-foreground">
            {integration.last_synced_at
              ? `Última sincronização: ${formatarDataHora(integration.last_synced_at)}`
              : 'Nunca sincronizado'}
          </span>
          <label
            className={`flex items-center gap-1.5 text-xs ${podeAlterarCompartilhamento ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
            title={podeAlterarCompartilhamento ? undefined : 'Só a conta que marcou como compartilhada pode desmarcar'}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
              checked={compartilhada}
              disabled={!podeAlterarCompartilhamento}
              onChange={(evento) => aoAlternarCompartilhamento(evento.target.checked ? null : accountId)}
            />
            Usar como integração única (compartilhada entre todas as contas)
          </label>
        </div>

        <div className="flex items-center gap-2">
          {integration.status !== 'disconnected' && (
            <Button variant="ghost" size="icon" onClick={() => setDialogoHistoricoAberto(true)} title="Histórico de sincronização">
              <History className="h-4 w-4" />
            </Button>
          )}
          {temSelecaoDeAtivos && integration.status !== 'disconnected' && (
            <Button variant="ghost" size="icon" onClick={() => setDialogoAtivosAberto(true)} title="Editar seleção de ativos">
              <ListChecks className="h-4 w-4" />
            </Button>
          )}
          {integration.status !== 'disconnected' && (
            <Button variant="ghost" size="icon" onClick={aoSincronizarAgora} disabled={sincronizando} title="Sincronizar agora">
              {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          )}
          <span
            title="Ativa a sincronização automática e o botão 'Sincronizar tudo' do dashboard."
            className="cursor-help text-muted-foreground"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
          <Switch checked={integration.is_active} onCheckedChange={aoAlternarAtiva} />
          <Button variant="outline" size="sm" onClick={() => setDialogoAberto(true)}>
            {integration.status === 'disconnected' ? 'Conectar' : 'Reconectar'}
          </Button>
        </div>
      </CardContent>

      <CredentialsDialog
        integrationKey={integration.key}
        integrationName={integration.name}
        integrationId={integration.id}
        accountId={accountId}
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        aoSalvarComSucesso={aoRecarregar}
      />

      {temSelecaoDeAtivos && (
        <AssetSelectionDialog
          integrationId={integration.id}
          integrationKey={integration.key}
          aberto={dialogoAtivosAberto}
          aoFechar={() => setDialogoAtivosAberto(false)}
          aoSalvarComSucesso={async () => {
            setDialogoAtivosAberto(false);
            await aoRecarregar();
          }}
        />
      )}

      <SyncHistoryDialog
        integrationId={integration.id}
        aberto={dialogoHistoricoAberto}
        aoFechar={() => setDialogoHistoricoAberto(false)}
      />
    </Card>
  );
}
