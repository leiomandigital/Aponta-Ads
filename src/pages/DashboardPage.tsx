import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/shared/AppLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ABAS_DASHBOARD,
  resolverSecoesGeral,
  type AbaDashboard,
  type PeriodoDashboard,
  type SecaoGeral,
} from '@/constants/dashboard.constants';
import { useDashboardMetrics, type IntervaloPersonalizado } from '@/features/dashboard/hooks/useDashboardMetrics';
import { useGlobalSyncStatus } from '@/features/settings/hooks/useGlobalSyncStatus';
import { useAccounts } from '@/features/settings/hooks/useAccounts';
import { CardsDeAnalytics, CardsGeral, SectionCards } from '@/features/dashboard/components/SectionCards';
import { AccountMultiSelect } from '@/features/dashboard/components/AccountMultiSelect';
import {
  CaminhosCard,
  ComparativoPlataformasTable,
  DispositivosTable,
  LeadsPorFormularioTable,
  OrigemMidiaTable,
  TituloSecao,
} from '@/features/dashboard/components/GeralSections';
import { ChartAreaInteractive, type SerieDoGrafico } from '@/features/dashboard/components/ChartAreaInteractive';
import { CampaignsTable } from '@/features/dashboard/components/CampaignsTable';
import { PeriodPicker } from '@/features/dashboard/components/PeriodPicker';
import { ExportPdfButton } from '@/features/export/components/ExportPdfButton';
import { SyncAllButton } from '@/features/dashboard/components/SyncAllButton';
import { formatarData, formatarMoeda, formatarNumero } from '@/utils/formatters';

export function DashboardPage() {
  const [aba, setAba] = useState<AbaDashboard>('geral');
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('30d');
  const [intervaloPersonalizado, setIntervaloPersonalizado] = useState<IntervaloPersonalizado | null>(null);
  // null = todas as contas (padrão); lista = só essas, somadas.
  const [contasSelecionadas, setContasSelecionadas] = useState<string[] | null>(null);

  const { accounts, carregando: carregandoContas } = useAccounts();
  // Conta desativada não aparece aqui pra seleção — some do dashboard, mas
  // continua existindo e gerenciável em Configurações (ver AccountsSection).
  const contasAtivas = useMemo(() => accounts.filter((conta) => conta.is_active), [accounts]);
  const idsContasInativas = useMemo(
    () => accounts.filter((conta) => !conta.is_active).map((conta) => conta.id),
    [accounts]
  );

  // Conta desativada enquanto o dashboard está aberto sai da seleção; se sobrar
  // nenhuma, volta pra "todas" em vez de filtrar por contas que não deveriam
  // mais ser filtráveis.
  useEffect(() => {
    if (!contasSelecionadas) return;
    const aindaAtivas = contasSelecionadas.filter((id) => contasAtivas.some((conta) => conta.id === id));
    if (aindaAtivas.length === contasSelecionadas.length) return;
    setContasSelecionadas(aindaAtivas.length > 0 ? aindaAtivas : null);
  }, [contasSelecionadas, contasAtivas]);

  const rotuloContas = useMemo(() => {
    if (!contasSelecionadas) return undefined;
    return contasAtivas
      .filter((conta) => contasSelecionadas.includes(conta.id))
      .map((conta) => conta.name)
      .join(', ');
  }, [contasSelecionadas, contasAtivas]);

  const {
    algumaIntegracaoAtiva,
    carregando: carregandoIntegracoes,
    erro: erroIntegracoes,
    sincronizandoTodas,
    sincronizarTodas,
  } = useGlobalSyncStatus();

  const {
    carregando,
    erro,
    metricasMidia,
    temDadosMidia,
    comparacaoMidia,
    detalhamentoCusto,
    comparacaoCustoDetalhado,
    metricasAnalytics,
    comparacaoAnalytics,
    serieCustoPorConversao,
    serieSessoesELeads,
    serieCustoPorLead,
    campanhas,
    dispositivos,
    jornadaDoLead,
    comparativoPlataformas,
    custoPorLead,
    custoPorLeadAnterior,
    distribuicaoLeads,
    linksFormularios,
    dataInicio,
    dataFim,
    recarregar,
  } = useDashboardMetrics(aba, periodo, contasSelecionadas ?? undefined, idsContasInativas, intervaloPersonalizado, !carregandoContas);

  const semIntegracaoConectada = !carregandoIntegracoes && !algumaIntegracaoAtiva;
  const mensagemVazio = semIntegracaoConectada
    ? 'conecte uma integração para ver dados aqui'
    : 'sem dados neste período — tente ampliar o intervalo';

  const handleSincronizarTudo = async () => {
    try {
      await sincronizarTodas();
    } catch {
      // erro já fica disponível via useGlobalSyncStatus().erro — sem tratamento extra aqui
    } finally {
      await recarregar();
    }
  };

  // Conversões por dia (da própria plataforma) e custo por conversão (custo total ÷ conversões) em gráficos separados.
  const seriesConversoes: SerieDoGrafico[] = [{ chave: 'conversions', rotulo: 'Conversões por dia', cor: 'var(--series-2)', formatarValor: formatarNumero }];
  const seriesCustoPorConversao: SerieDoGrafico[] = [
    { chave: 'cost_per_conversion', rotulo: 'Custo por conversão', cor: 'var(--series-1)', formatarValor: formatarMoeda },
  ];

  // Sessões (GA4) e leads (RD Station) em gráficos separados — cada um com sua própria escala.
  const seriesSessoes: SerieDoGrafico[] = [{ chave: 'sessions', rotulo: 'Sessões', cor: 'var(--series-1)', formatarValor: formatarNumero }];
  const seriesLeads: SerieDoGrafico[] = [{ chave: 'leads', rotulo: 'Leads', cor: 'var(--series-2)', formatarValor: formatarNumero }];

  const seriesCustoPorLead: SerieDoGrafico[] = [
    { chave: 'cost_per_lead', rotulo: 'Custo por lead', cor: 'var(--series-1)', formatarValor: formatarMoeda },
  ];

  const secoesGeral = resolverSecoesGeral();

  const renderizarSecaoGeral = (secao: SecaoGeral) => {
    switch (secao) {
      case 'cards_midia':
        return (
          <CardsGeral
            key={secao}
            metricas={metricasMidia}
            temDados={temDadosMidia}
            comparacao={comparacaoMidia}
            detalhamentoCusto={detalhamentoCusto}
            comparacaoCustoDetalhado={comparacaoCustoDetalhado}
            custoPorLead={custoPorLead}
            custoPorLeadAnterior={custoPorLeadAnterior}
            carregando={carregando}
          />
        );
      case 'cards_analytics':
        return <CardsDeAnalytics key={secao} metricas={metricasAnalytics} comparacao={comparacaoAnalytics} carregando={carregando} />;
      case 'graficos':
        return (
          <div key={secao} className="grid grid-cols-1 gap-4">
            <ChartAreaInteractive
              titulo="Sessões"
              plataformas={['ga4']}
              descricao="Tendência no período selecionado"
              dados={serieSessoesELeads}
              series={seriesSessoes}
              carregando={carregando}
            />
            <ChartAreaInteractive
              titulo="Leads"
              tipo="barras"
              plataformas={['rd_station']}
              descricao="Tendência no período selecionado"
              dados={serieSessoesELeads}
              series={seriesLeads}
              carregando={carregando}
            />
            <ChartAreaInteractive
              titulo="Custo por lead"
              plataformas={['rd_station']}
              descricao="Tendência no período selecionado"
              dados={serieCustoPorLead}
              series={seriesCustoPorLead}
              carregando={carregando}
            />
          </div>
        );
      case 'grafico_sessoes_leads':
        return (
          <div key={secao} className="grid grid-cols-1 gap-4">
            <ChartAreaInteractive
              titulo="Sessões"
              plataformas={['ga4']}
              descricao="Tendência no período selecionado"
              dados={serieSessoesELeads}
              series={seriesSessoes}
              carregando={carregando}
            />
            <ChartAreaInteractive
              titulo="Leads"
              tipo="barras"
              plataformas={['rd_station']}
              descricao="Tendência no período selecionado"
              dados={serieSessoesELeads}
              series={seriesLeads}
              carregando={carregando}
            />
          </div>
        );
      case 'caminhos':
        return <CaminhosCard key={secao} caminhos={jornadaDoLead.caminhos} carregando={carregando} />;
      case 'leads_por_formulario':
        return (
          <section key={secao} className="flex flex-col gap-3">
            <TituloSecao titulo="Leads por formulário" plataformas={['rd_station']} />
            <LeadsPorFormularioTable itens={distribuicaoLeads.porFormulario} links={linksFormularios} carregando={carregando} mensagemVazio={mensagemVazio} />
          </section>
        );
      case 'origem_midia':
        return (
          <section key={secao} className="flex flex-col gap-3">
            <TituloSecao titulo="Origem/mídia" plataformas={['ga4']} />
            <OrigemMidiaTable itens={jornadaDoLead.origens} carregando={carregando} mensagemVazio={mensagemVazio} />
          </section>
        );
      case 'dispositivos':
        return (
          <section key={secao} className="flex flex-col gap-3">
            <TituloSecao titulo="Sessões por dispositivo" plataformas={['ga4']} />
            <DispositivosTable linhas={dispositivos} carregando={carregando} mensagemVazio={mensagemVazio} />
          </section>
        );
      case 'comparativo_plataformas':
        return (
          <section key={secao} className="flex flex-col gap-3">
            <TituloSecao titulo="Comparativo de plataformas" plataformas={['google_ads', 'meta_ads']} />
            <ComparativoPlataformasTable linhas={comparativoPlataformas} carregando={carregando} mensagemVazio={mensagemVazio} />
          </section>
        );
    }
  };

  return (
    <AppLayout titulo="Dashboard">
      <div className="flex flex-col gap-6">
        {/* sticky logo abaixo do SiteHeader (h-14, também sticky) — margem
            negativa cancela o padding do <main> nos 3 lados de cima (topo e
            laterais), pra a barra ficar colada no header e encostada nas
            bordas mesmo, sem espaço em branco entre os dois. */}
        <div className="sticky top-14 z-30 -mx-4 -mt-4 flex flex-col gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:-mx-6 md:-mt-6 md:px-6">
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

            <ExportPdfButton
              parametros={{
                aba,
                accountIds: contasSelecionadas ?? undefined,
                accountName: rotuloContas,
                dataInicio,
                dataFim,
              }}
            />

            {contasAtivas.length > 1 && (
              <AccountMultiSelect contas={contasAtivas} selecionadas={contasSelecionadas} aoAlterar={setContasSelecionadas} />
            )}

            {/* No período personalizado o próprio botão do seletor já mostra o intervalo. */}
            {periodo !== 'custom' && (
              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground" title="Período selecionado">
                {formatarData(dataInicio)} a {formatarData(dataFim)}
              </span>
            )}

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

        {aba === 'geral' ? (
          <div className="flex flex-col gap-6">{secoesGeral.map(renderizarSecaoGeral)}</div>
        ) : (
          <>
            <SectionCards
              aba={aba}
              metricasMidia={metricasMidia}
              temDadosMidia={temDadosMidia}
              comparacaoMidia={comparacaoMidia}
              detalhamentoCusto={detalhamentoCusto}
              comparacaoCustoDetalhado={comparacaoCustoDetalhado}
              carregando={carregando}
            />

            <ChartAreaInteractive
              titulo="Conversões por dia"
              tipo="barras"
              descricao="Tendência no período selecionado"
              dados={serieCustoPorConversao}
              series={seriesConversoes}
              carregando={carregando}
            />

            <ChartAreaInteractive
              titulo="Custo por conversão"
              descricao="Tendência no período selecionado"
              dados={serieCustoPorConversao}
              series={seriesCustoPorConversao}
              carregando={carregando}
            />

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Campanhas</h2>
              <CampaignsTable
                campanhas={campanhas}
                carregando={carregando}
                mensagemVazio={mensagemVazio}
                modo={aba}
              />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
