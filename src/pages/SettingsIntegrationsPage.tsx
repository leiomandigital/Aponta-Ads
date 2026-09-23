import { AppLayout } from '@/components/shared/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useIntegrations } from '@/features/settings/hooks/useIntegrations';
import { IntegrationCard } from '@/features/settings/components/IntegrationCard';
import { RegionMappingSection } from '@/features/settings/components/RegionMappingSection';
import { BrandSettingsSection } from '@/features/settings/components/BrandSettingsSection';

export function SettingsIntegrationsPage() {
  const { integrations, carregando, erro, sincronizandoKey, alternarAtiva, sincronizarAgora, recarregar } = useIntegrations();

  return (
    <AppLayout titulo="Configurações">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
            <CardDescription>Conecte cada plataforma para começar a sincronizar dados no dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {erro && <p className="text-sm text-destructive">{erro}</p>}

            {carregando ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              integrations.map((integration) => (
                <IntegrationCard
                  key={integration.key}
                  integration={integration}
                  sincronizando={sincronizandoKey === integration.key}
                  aoAlternarAtiva={(isActive) => alternarAtiva(integration.key, isActive)}
                  aoSincronizarAgora={() => sincronizarAgora(integration.key)}
                  aoRecarregar={recarregar}
                />
              ))
            )}
          </CardContent>
        </Card>

        <RegionMappingSection />
        <BrandSettingsSection />
      </div>
    </AppLayout>
  );
}
