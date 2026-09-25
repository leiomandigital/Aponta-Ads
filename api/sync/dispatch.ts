import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { executarSincronizacao } from '../../src/integrations/syncRunner.js';
import { autenticarCron, autenticarUsuario } from '../_lib/auth.js';

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

  // Desde a migration 026, uma key de plataforma pode ter várias linhas de
  // `integrations` (uma por conta, mais a compartilhada) — o parâmetro
  // manual passou a identificar a LINHA (id), não mais a plataforma.
  const integrationParam = typeof req.query.integration === 'string' ? req.query.integration : undefined;
  // Igual em todas as etapas de um mesmo clique de "sincronizar agora" (ver
  // integrationsService.ts) — permite a tela de histórico agrupá-las como um
  // evento só (migration 037). Nunca vem no disparo automático.
  const runIdParam = typeof req.query.runId === 'string' ? req.query.runId : undefined;

  const supabaseAdmin = criarSupabaseAdminClient();

  // Chamada manual (com ?integration=<id>) sincroniza só aquela linha.
  // Chamada do cron (sem parâmetro) sincroniza todas as linhas ativas em
  // paralelo — Promise.allSettled garante que uma falha não derruba as outras.
  if (integrationParam) {
    const { data: integracao, error: erroIntegracao } = await supabaseAdmin
      .from('integrations')
      .select('id')
      .eq('id', integrationParam)
      .maybeSingle();

    if (erroIntegracao) {
      return res.status(500).json({ error: erroIntegracao.message });
    }
    if (!integracao) {
      return res.status(404).json({ error: `Integração desconhecida: ${integrationParam}` });
    }

    const resultado = await executarSincronizacao(supabaseAdmin, integrationParam, runIdParam);
    const statusHttp = resultado.status === 'error' ? 502 : 200;
    return res.status(statusHttp).json(resultado);
  }

  const { data: integracoesAtivas, error } = await supabaseAdmin
    .from('integrations')
    .select('id, key')
    .eq('is_active', true);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const resultados = await Promise.allSettled(
    (integracoesAtivas ?? []).map((integracao) =>
      executarSincronizacao(supabaseAdmin, integracao.id).then((resultado) => ({
        integration: integracao.key,
        integrationId: integracao.id,
        ...resultado,
      }))
    )
  );

  const resumo = resultados.map((resultado, indice) =>
    resultado.status === 'fulfilled'
      ? resultado.value
      : {
          integration: integracoesAtivas?.[indice]?.key,
          integrationId: integracoesAtivas?.[indice]?.id,
          status: 'error',
          errorMessage: String(resultado.reason),
        }
  );

  return res.status(200).json({ resultados: resumo });
}
