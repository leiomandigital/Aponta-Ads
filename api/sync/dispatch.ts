import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { executarSincronizacao } from '../../src/integrations/syncRunner.js';
import type { IntegrationKey } from '../../src/integrations/types.js';
import { autenticarCron, autenticarUsuario } from '../_lib/auth.js';

const CHAVES_VALIDAS: IntegrationKey[] = ['google_ads', 'ga4', 'meta_ads', 'rd_station'];

// O Vercel Cron chama o path agendado com GET (enviando Authorization: Bearer
// <CRON_SECRET>), então GET só é aceito quando a credencial do cron é válida.
// POST segue aceito para cron e para a chamada manual do usuário logado
// (botão "sincronizar agora") — ver Integration Security Skill, seção 2.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ehCron = autenticarCron(req);

  const metodoPermitido = req.method === 'POST' || (req.method === 'GET' && ehCron);
  if (!metodoPermitido) {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuarioId = ehCron ? null : await autenticarUsuario(req);

  if (!ehCron && !usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const integrationParam = typeof req.query.integration === 'string' ? req.query.integration : undefined;

  if (integrationParam && !CHAVES_VALIDAS.includes(integrationParam as IntegrationKey)) {
    return res.status(400).json({ error: `Integração desconhecida: ${integrationParam}` });
  }

  const supabaseAdmin = criarSupabaseAdminClient();

  // Chamada manual (com ?integration=) sincroniza só aquela integração.
  // Chamada do cron (sem parâmetro) sincroniza todas as ativas em paralelo —
  // Promise.allSettled garante que uma falha não derruba as outras.
  if (integrationParam) {
    const resultado = await executarSincronizacao(supabaseAdmin, integrationParam as IntegrationKey);
    const statusHttp = resultado.status === 'error' ? 502 : 200;
    return res.status(statusHttp).json(resultado);
  }

  const { data: integracoesAtivas, error } = await supabaseAdmin
    .from('integrations')
    .select('key')
    .eq('is_active', true);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const resultados = await Promise.allSettled(
    (integracoesAtivas ?? []).map((integracao) =>
      executarSincronizacao(supabaseAdmin, integracao.key as IntegrationKey).then((resultado) => ({
        integration: integracao.key,
        ...resultado,
      }))
    )
  );

  const resumo = resultados.map((resultado, indice) =>
    resultado.status === 'fulfilled'
      ? resultado.value
      : { integration: integracoesAtivas?.[indice]?.key, status: 'error', errorMessage: String(resultado.reason) }
  );

  return res.status(200).json({ resultados: resumo });
}
