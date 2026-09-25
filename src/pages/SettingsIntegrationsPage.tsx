import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/shared/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/features/settings/hooks/useAccounts';
import { useIntegrations } from '@/features/settings/hooks/useIntegrations';
import { AccountsSection } from '@/features/settings/components/AccountsSection';
import { IntegrationCard } from '@/features/settings/components/IntegrationCard';
import { NewIntegrationCard } from '@/features/settings/components/NewIntegrationCard';
import { BrandSettingsSection } from '@/features/settings/components/BrandSettingsSection';

export function SettingsIntegrationsPage() {
  const {
    accounts,
    idsComIntegracao,
    carregando: carregandoContas,
    salvando: salvandoConta,
    erro: erroContas,
    criar,
    renomear,
    ativarDesativar: ativarDesativarConta,
    excluir,
  } = useAccounts();
  const [contaSelecionadaId, setContaSelecionadaId] = useState<string | null>(null);

  // Conta padrão pré-selecionada assim que a lista chega — evita a tela ficar
  // sem nenhuma conta escolhida (useIntegrations exige uma conta). Também
  // recai pra outra conta se a selecionada tiver sido excluída (só é possível
  // excluir uma sem integração nenhuma, então não há nada de "Configurando a
  // conta" pra perder ao trocar).
  useEffect(() => {
    if (accounts.length === 0) return;
    if (!contaSelecionadaId || !accounts.some((conta) => conta.id === contaSelecionadaId)) {
      setContaSelecionadaId(accounts.find((conta) => conta.is_default)?.id ?? accounts[0].id);
    }
  }, [accounts, contaSelecionadaId]);

  const {
    integrations,
    faltantes,
    carregando: carregandoIntegracoes,
    erro: erroIntegracoes,
    sincronizandoId,
    alternarAtiva,
    alternarCompartilhamento,
    sincronizarAgora,
    recarregar,
  } = useIntegrations(contaSelecionadaId ?? '');

  return (
    <AppLayout titulo="Configurações">
      <div className="flex flex-col gap-6">
        <AccountsSection
          accounts={accounts}
          idsComIntegracao={idsComIntegracao}
          carregando={carregandoContas}
          onCriar={criar}
          onRenomear={renomear}
          onAtivarDesativar={ativarDesativarConta}
          onExcluir={excluir}
          erro={erroContas}
          salvando={salvandoConta}
        />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Integrações</CardTitle>
              <CardDescription>
                Cada conta conecta suas próprias plataformas. Use o seletor ao lado para trocar de conta e configurar a integração dela.
              </CardDescription>
            </div>
            {accounts.length > 1 && contaSelecionadaId && (
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor="seletor-conta-integracoes" className="shrink-0 text-sm font-medium">
                  Configurando a conta:
                </Label>
                <Select value={contaSelecionadaId} onValueChange={setContaSelecionadaId}>
                  <SelectTrigger id="seletor-conta-integracoes" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {erroIntegracoes && <p className="text-sm text-destructive">{erroIntegracoes}</p>}

            {!carregandoContas && accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cadastre uma conta acima para conectar integrações.</p>
            ) : carregandoContas || carregandoIntegracoes || !contaSelecionadaId ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    accountId={contaSelecionadaId}
                    sincronizando={sincronizandoId === integration.id}
                    aoAlternarAtiva={(isActive) => alternarAtiva(integration.id, isActive)}
                    aoAlternarCompartilhamento={(novoAccountId) => alternarCompartilhamento(integration.id, novoAccountId)}
                    aoSincronizarAgora={() => sincronizarAgora(integration.id)}
                    aoRecarregar={recarregar}
                  />
                ))}
                {faltantes.map((plataforma) => (
                  <NewIntegrationCard
                    key={plataforma.key}
                    integrationKey={plataforma.key}
                    integrationName={plataforma.name}
                    accountId={contaSelecionadaId}
                    aoRecarregar={recarregar}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <BrandSettingsSection />
      </div>
    </AppLayout>
  );
}
