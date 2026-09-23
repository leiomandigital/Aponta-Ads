import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renderToBuffer } from '@react-pdf/renderer';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { ReportDocument } from '../../src/features/export/pdf/ReportDocument.js';
import { autenticarUsuario } from '../_lib/auth.js';
import {
  buscarCampanhas,
  buscarConfiguracoesDeMarca,
  buscarCustoPorLeadPorOrigem,
  buscarMetricasAnalytics,
  buscarMetricasDeMidiaPaga,
  buscarSerieTemporalAnalytics,
  buscarSerieTemporalMidiaPaga,
  buscarSessoesPorPagina,
} from '../_lib/reportData.js';
import type { Platform, Region } from '../../src/types/database.types.js';

const ABAS_VALIDAS = ['geral', 'google_ads', 'meta_ads', 'analytics'];

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

  const { aba, region, dataInicio, dataFim } = req.body ?? {};

  if (!ABAS_VALIDAS.includes(aba) || !dataInicio || !dataFim) {
    return res.status(400).json({ error: 'Parâmetros de exportação inválidos' });
  }

  const regiaoFiltro: Region | undefined = region === 'ES' || region === 'TO' ? region : undefined;
  const platformFiltro: Platform | undefined = aba === 'google_ads' || aba === 'meta_ads' ? aba : undefined;

  try {
    const supabaseAdmin = criarSupabaseAdminClient();
    const configuracoes = await buscarConfiguracoesDeMarca(supabaseAdmin);

    const filtrosMidia = { dataInicio, dataFim, region: regiaoFiltro, platform: platformFiltro };
    const filtrosAnalytics = { dataInicio, dataFim, region: regiaoFiltro };
    const incluiMidia = aba !== 'analytics';
    const incluiAnalytics = aba === 'analytics' || aba === 'geral';

    const [
      metricasMidia,
      metricasAnalytics,
      custoPorLead,
      campanhas,
      serieTemporalMidia,
      serieTemporalAnalytics,
      sessoesPorPagina,
    ] = await Promise.all([
      incluiMidia ? buscarMetricasDeMidiaPaga(supabaseAdmin, filtrosMidia) : Promise.resolve(null),
      incluiAnalytics ? buscarMetricasAnalytics(supabaseAdmin, filtrosAnalytics) : Promise.resolve(null),
      aba === 'geral' ? buscarCustoPorLeadPorOrigem(supabaseAdmin, { dataInicio, dataFim }) : Promise.resolve(undefined),
      incluiMidia ? buscarCampanhas(supabaseAdmin, filtrosMidia) : Promise.resolve(undefined),
      incluiMidia ? buscarSerieTemporalMidiaPaga(supabaseAdmin, filtrosMidia) : Promise.resolve(undefined),
      incluiAnalytics ? buscarSerieTemporalAnalytics(supabaseAdmin, filtrosAnalytics) : Promise.resolve(undefined),
      incluiAnalytics ? buscarSessoesPorPagina(supabaseAdmin, filtrosAnalytics) : Promise.resolve(undefined),
    ]);

    const buffer = await renderToBuffer(
      ReportDocument({
        aba,
        regiao: region,
        dataInicio,
        dataFim,
        logoUrl: configuracoes?.client_logo_url,
        metricasMidia,
        metricasAnalytics,
        serieTemporalMidia,
        serieTemporalAnalytics,
        custoPorLead,
        campanhas,
        sessoesPorPagina,
      })
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="apontaads-${aba}-${dataInicio}-a-${dataFim}.pdf"`);
    return res.status(200).send(buffer);
  } catch (erro) {
    console.error('Falha ao gerar PDF:', erro instanceof Error ? erro.message : erro);
    return res.status(500).json({ error: 'Falha ao gerar o PDF' });
  }
}
