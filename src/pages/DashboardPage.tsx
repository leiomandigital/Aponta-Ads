import { useState } from 'react';
import { X } from 'lucide-react';
import { AppLayout } from '@/components/shared/AppLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ABAS_DASHBOARD, REGIOES_DASHBOARD, type AbaDashboard, type PeriodoDashboard, type RegiaoDashboard } from '@/constants/dashboard.constants';
import { useDashboardMetrics, type IntervaloPersonalizado } from '@/features/dashboard/hooks/useDashboardMetrics';
import { useIntegrations } from '@/features/settings/hooks/useIntegrations';
import { SectionCards } from '@/features/dashboard/components/SectionCards';
import { ChartAreaInteractive, type SerieDoGrafico } from '@/features/dashboard/components/ChartAreaInteractive';
import { CampaignsTable } from '@/features/dashboard/components/CampaignsTable';
import { AdSetsTable } from '@/features/dashboard/components/AdSetsTable';
import { AdsTable } from '@/features/dashboard/components/AdsTable';
import { TopPagesTable } from '@/features/dashboard/components/TopPagesTable';
import { LeadsTable } from '@/features/dashboard/components/LeadsTable';
import { PeriodPicker } from '@/features/dashboard/components/PeriodPicker';
import { ExportPdfButton } from '@/features/export/components/ExportPdfButton';
import { SyncAllButton } from '@/features/dashboard/components/SyncAllButton';
import { formatarMoeda, formatarNumero } from '@/utils/formatters';

export function DashboardPage() {
  const [aba, setAba] = useState<AbaDashboard>('geral');
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('30d');
  const [intervaloPersonalizado, setIntervaloPersonalizado] = useState<IntervaloPersonalizado | null>(null);
  const [regiao, setRegiao] = useState<RegiaoDashboard>('todas');

  const {
    algumaIntegracaoAtiva,
    carregando: carregandoIntegracoes,
    erro: erroIntegracoes,
    sincronizandoTodas,
    sincronizarTodas,
  } = useIntegrations();

  const {
    carregando,
    erro,
    metricasMidia,
    temDadosMidia,
    comparacaoMidia,
    metricasAnalytics,
    comparacaoAnalytics,
    serieTemporalMidia,
    serieTemporalAnalytics,
    serieCustoPorLead,
    campanhas,
    conjuntos,
    anuncios,
    selecao,
    selecionarCampanha,
    selecionarConjunto,
    selecionarAnuncio,
    limparSelecao,
    paginas,
    leadsRecentes,
    custoPorLead,
    custoPorLeadAnterior,
    dataInicio,
    dataFim,
    recarregar,
  } = useDashboardMetrics(aba, periodo, regiao, intervaloPersonalizado);

  const semIntegracaoConectada = !carregandoIntegracoes && !algumaIntegracaoAtiva;
  const mensagemVazio = semIntegracaoConectada
    ? 'conecte uma integração para ver dados aqui'
    : 'sem dados neste período — tente ampliar o intervalo';

  const handleSincronizarTudo = async () => {
    try {
      await sincronizarTodas();
    } catch {
      // erro já fica disponível via useIntegrations().erro — sem tratamento extra aqui
    } finally {
      await recarregar();
    }
  };

  const seriesMidia: SerieDoGrafico[] = [
    { chave: 'cost', rotulo: 'Custo', cor: 'var(--series-1)', formatarValor: formatarMoeda },
    { chave: 'conversions', rotulo: 'Conversões', cor: 'var(--series-2)', formatarValor: formatarNumero },
  ];

  const seriesAnalytics: SerieDoGrafico[] = [
    { chave: 'sessions', rotulo: 'Sessões', cor: 'var(--series-1)', formatarValor: formatarNumero },
    { chave: 'users', rotulo: 'Usuários', cor: 'var(--series-2)', formatarValor: formatarNumero },
  ];

  const seriesSessoesELeads: SerieDoGrafico[] = [
    { chave: 'sessions', rotulo: 'Sessões', cor: 'var(--series-1)', formatarValor: formatarNumero },
    { chave: 'leads', rotulo: 'Leads', cor: 'var(--series-2)', formatarValor: formatarNumero },
  ];

  const seriesCustoPorLead: SerieDoGrafico[] = [
    { chave: 'cost_per_lead', rotulo: 'Custo por lead', cor: 'var(--series-1)', formatarValor: formatarMoeda },
  ];

  const seriesCustoPorConversao: SerieDoGrafico[] = [
    { chave: 'cpa', rotulo: 'Custo por conversão', cor: 'var(--series-1)', formatarValor: formatarMoeda },
  ];

  const mostraDrillDownDeMidia = aba === 'google_ads' || aba === 'meta_ads';
  const algumaSelecaoAtiva = !!(selecao.campaignId || selecao.adsetId || selecao.adId);

  return (
    <AppLayout titulo="Dashboard">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={aba} onValueChange={(valor) => setAba(valor as AbaDashboard)}>
            <TabsList>
              {ABAS_DASHBOARD.map((item) => (
                <TabsTrigger key={item.valor} value={item.valor}>
                  {item.rotulo}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <SyncAllButton
              sincronizando={sincronizandoTodas}
              desabilitado={!carregandoIntegracoes && !algumaIntegracaoAtiva}
              aoClicar={handleSincronizarTudo}
            />

            <ExportPdfButton parametros={{ aba, region: regiao, dataInicio, dataFim }} />

            <Select value={regiao} onValueChange={(valor) => setRegiao(valor as RegiaoDashboard)}>
              <SelectTrigger className="w-[140px] sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIOES_DASHBOARD.map((item) => (
                  <SelectItem key={item.valor} value={item.valor}>
                    {item.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <PeriodPicker
              periodo={periodo}
              intervaloPersonalizado={intervaloPersonalizado}
              aoSelecionarPreset={setPeriodo}
              aoAplicarIntervaloPersonalizado={(intervalo) => {
                setIntervaloPersonalizado(intervalo);
                setPeriodo('custom');
              }}
            />
          </div>
        </div>

        {(erro || erroIntegracoes) && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {erro || erroIntegracoes}
          </div>
        )}

        {mostraDrillDownDeMidia && algumaSelecaoAtiva && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Cards e gráfico filtrados pela seleção nas tabelas abaixo.</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={limparSelecao}>
              <X className="h-3 w-3" />
              Limpar seleção
            </Button>
          </div>
        )}

        <SectionCards
          aba={aba}
          metricasMidia={metricasMidia}
          temDadosMidia={temDadosMidia}
          comparacaoMidia={comparacaoMidia}
          metricasAnalytics={metricasAnalytics}
          comparacaoAnalytics={comparacaoAnalytics}
          custoPorLead={custoPorLead}
          custoPorLeadAnterior={custoPorLeadAnterior}
          carregando={carregando}
        />

        {aba === 'analytics' ? (
          <ChartAreaInteractive
            titulo="Sessões e usuários"
            descricao={`Tendência no período selecionado`}
            dados={serieTemporalAnalytics}
            series={seriesAnalytics}
            carregando={carregando}
          />
        ) : aba !== 'geral' ? (
          <ChartAreaInteractive
            titulo="Custo e conversões"
            descricao="Tendência no período selecionado"
            dados={serieTemporalMidia}
            series={seriesMidia}
            carregando={carregando}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartAreaInteractive
              titulo="Sessões e leads"
              descricao="Tendência no período selecionado"
              dados={serieTemporalAnalytics}
              series={seriesSessoesELeads}
              carregando={carregando}
            />
            <ChartAreaInteractive
              titulo="Custo por lead"
              descricao="Tendência no período selecionado"
              dados={serieCustoPorLead}
              series={seriesCustoPorLead}
              carregando={carregando}
            />
            <ChartAreaInteractive
              titulo="Custo por conversão"
              descricao="Tendência no período selecionado"
              dados={serieTemporalMidia}
              series={seriesCustoPorConversao}
              carregando={carregando}
            />
          </div>
        )}

        {aba === 'geral' ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Leads recentes</h2>
            <LeadsTable leads={leadsRecentes} carregando={carregando} mensagemVazio={mensagemVazio} />
          </div>
        ) : aba === 'analytics' ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Principais páginas</h2>
            <TopPagesTable paginas={paginas} carregando={carregando} mensagemVazio={mensagemVazio} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Campanhas</h2>
              <CampaignsTable
                campanhas={campanhas}
                carregando={carregando}
                mensagemVazio={mensagemVazio}
                campanhaSelecionadaId={selecao.campaignId}
                aoSelecionarCampanha={selecionarCampanha}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Conjuntos de anúncio</h2>
              <AdSetsTable
                conjuntos={conjuntos}
                carregando={carregando}
                mensagemVazio="sem conjuntos de anúncio para mostrar"
                conjuntoSelecionadoId={selecao.adsetId}
                aoSelecionarConjunto={selecionarConjunto}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Anúncios</h2>
              <AdsTable
                anuncios={anuncios}
                carregando={carregando}
                mensagemVazio="sem anúncios para mostrar"
                anuncioSelecionadoId={selecao.adId}
                aoSelecionarAnuncio={selecionarAnuncio}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
