import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renderToBuffer } from '@react-pdf/renderer';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { ReportDocument } from '../../src/features/export/pdf/ReportDocument.js';
import { autenticarUsuario } from '../_lib/auth.js';
import { buscarConfiguracoesDeMarca } from '../_lib/reportData.js';
import { criarDashboardQueries } from '../../src/services/dashboardQueries.js';
import { calcularPainelDeAnalytics, calcularPainelDeMidia, calcularSerieCustoPorConversao, calcularSerieCustoPorLead, calcularSerieSessoesELeads } from '../../src/utils/painelCalculos.js';
import { calcularPeriodoAnterior, DISTRIBUICAO_VAZIA, JORNADA_VAZIA } from '../../src/utils/metricsAggregation.js';
import type { Platform } from '../../src/types/database.types.js';

const ABAS_VALIDAS = ['geral', 'google_ads', 'meta_ads'];

// Os ids entram numa string de filtro do PostgREST (.or) — só aceita UUID pra nunca deixar o cliente injetar sintaxe de filtro.
const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chamado pelo próprio usuário logado — exige sessão válida (diferente do
// dispatch, que também aceita CRON_SECRET). Ver arquitetura, seção 10.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuarioId = await autenticarUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { aba, accountIds, accountName, dataInicio, dataFim } = req.body ?? {};

  if (!ABAS_VALIDAS.includes(aba) || !dataInicio || !dataFim) {
    return res.status(400).json({ error: 'Parâmetros de exportação inválidos' });
  }

  if (accountIds !== undefined && (!Array.isArray(accountIds) || !accountIds.every((id) => typeof id === 'string' && PADRAO_UUID.test(id)))) {
    return res.status(400).json({ error: 'Parâmetros de exportação inválidos' });
  }

  const accountIdsFiltro: string[] | undefined = Array.isArray(accountIds) && accountIds.length > 0 ? accountIds : undefined;
  const platformFiltro: Platform | undefined = aba === 'google_ads' || aba === 'meta_ads' ? aba : undefined;
  const ehGeral = aba === 'geral';

  try {
    const supabaseAdmin = criarSupabaseAdminClient();
    const configuracoes = await buscarConfiguracoesDeMarca(supabaseAdmin);

    // Calculado aqui, nunca recebido do cliente: o PDF de "todas as contas"
    // precisa somar só as contas ativas (mais as compartilhadas) — igual ao
    // dashboard. Só busca quando faz diferença (accountIds não informado).
    let idsContasInativas: string[] = [];
    if (!accountIdsFiltro) {
      const { data: contasInativas, error: erroContas } = await supabaseAdmin.from('accounts').select('id').eq('is_active', false);
      if (erroContas) throw new Error(erroContas.message);
      idsContasInativas = (contasInativas ?? []).map((conta) => conta.id as string);
    }

    // As mesmas consultas e os mesmos cálculos do dashboard (dashboardQueries + painelCalculos): o PDF
    // mostra exatamente o que está na tela para a aba, o período e as contas selecionados.
    const consultas = criarDashboardQueries(supabaseAdmin);
    const { dataInicio: dataInicioAnterior, dataFim: dataFimAnterior } = calcularPeriodoAnterior(dataInicio, dataFim);
    const filtrosMidia = { dataInicio, dataFim, platform: platformFiltro, accountIds: accountIdsFiltro, idsContasInativas };
    const filtrosMidiaAnterior = { ...filtrosMidia, dataInicio: dataInicioAnterior, dataFim: dataFimAnterior };
    const filtrosAnalytics = { dataInicio, dataFim, accountIds: accountIdsFiltro, idsContasInativas };
    const filtrosAnalyticsAnterior = { ...filtrosAnalytics, dataInicio: dataInicioAnterior, dataFim: dataFimAnterior };

    const [
      linhasMidia,
      linhasMidiaAnteriores,
      lancamentos,
      lancamentosAnteriores,
      linhasAnalytics,
      linhasAnalyticsAnteriores,
      jornadaDoLead,
      distribuicaoLeads,
      custoPorLead,
      custoPorLeadAnterior,
      linksFormularios,
    ] = await Promise.all([
      consultas.obterLinhasDeMidia(filtrosMidia),
      consultas.obterLinhasDeMidia(filtrosMidiaAnterior),
      consultas.obterLancamentosDeCusto(filtrosMidia),
      consultas.obterLancamentosDeCusto(filtrosMidiaAnterior),
      ehGeral ? consultas.obterLinhasDeAnalytics(filtrosAnalytics) : Promise.resolve([]),
      ehGeral ? consultas.obterLinhasDeAnalytics(filtrosAnalyticsAnterior) : Promise.resolve([]),
      ehGeral ? consultas.obterJornadaDoLead(filtrosAnalytics) : Promise.resolve(JORNADA_VAZIA),
      ehGeral ? consultas.obterDistribuicaoDeLeads(filtrosAnalytics) : Promise.resolve(DISTRIBUICAO_VAZIA),
      ehGeral ? consultas.obterCustoPorLeadPorOrigem(filtrosAnalytics) : Promise.resolve([]),
      ehGeral ? consultas.obterCustoPorLeadPorOrigem(filtrosAnalyticsAnterior) : Promise.resolve([]),
      ehGeral ? consultas.obterLinksDeFormularios() : Promise.resolve({} as Record<string, string>),
    ]);

    const painelMidia = calcularPainelDeMidia({
      linhasAtual: linhasMidia,
      linhasAnterior: linhasMidiaAnteriores,
      lancamentosAtual: lancamentos,
      lancamentosAnterior: lancamentosAnteriores,
    });

    const buffer = await renderToBuffer(
      ReportDocument({
        aba,
        conta: typeof accountName === 'string' && accountName ? accountName : 'Todas as contas',
        dataInicio,
        dataFim,
        nomeDoSistema: configuracoes?.system_name,
        logoUrl: configuracoes?.client_logo_url,
        painelMidia,
        painelAnalytics: ehGeral ? calcularPainelDeAnalytics(linhasAnalytics, linhasAnalyticsAnteriores) : undefined,
        custoPorLead,
        custoPorLeadAnterior,
        serieSessoesELeads: ehGeral
          ? calcularSerieSessoesELeads(calcularPainelDeAnalytics(linhasAnalytics, linhasAnalyticsAnteriores).serieTemporalAnalytics, custoPorLead, dataInicio, dataFim)
          : [],
        serieCustoPorConversao: ehGeral ? [] : calcularSerieCustoPorConversao(linhasMidia, lancamentos, dataInicio, dataFim),
        serieCustoPorLead: ehGeral ? calcularSerieCustoPorLead(custoPorLead, linhasMidia, lancamentos, dataInicio, dataFim) : [],
        jornadaDoLead,
        distribuicaoLeads,
        linksFormularios,
      })
    );

    res.setHeader('Content-Type', 'application/pdf');
    // Nome do arquivo: <nome configurado em Configurações>-<aba>-<início>-a-<fim>.pdf
    const nomeSeguro = (configuracoes?.system_name ?? '').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-') || 'ApontaAds';
    const nomeArquivo = `${nomeSeguro}-${String(aba).replace(/_/g, '-')}-${dataInicio}-a-${dataFim}.pdf`;
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nomeArquivo.replace(/[^ -~]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`
    );
    return res.status(200).send(buffer);
  } catch (erro) {
    console.error('Falha ao gerar PDF:', erro instanceof Error ? erro.message : erro);
    return res.status(500).json({ error: 'Falha ao gerar o PDF' });
  }
}
