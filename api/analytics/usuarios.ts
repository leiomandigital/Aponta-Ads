import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { obterUsuariosDoPeriodoGa4 } from '../../src/integrations/ga4/usuariosDoPeriodo.js';
import { autenticarUsuario } from '../_lib/auth.js';
import { buscarIdsContasInativas } from '../_lib/reportData.js';

// Os ids entram numa string de filtro do PostgREST (.or) — só aceita UUID pra nunca deixar o cliente injetar sintaxe de filtro.
const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PADRAO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Usuários únicos do período direto do GA4 (total e por dispositivo). O dashboard não consegue isso do banco: o
 * total de usuários de um período não é a soma dos usuários de cada dia. Chamado pelo usuário logado — exige sessão válida.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuarioId = await autenticarUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { accountIds, dataInicio, dataFim } = req.body ?? {};

  if (typeof dataInicio !== 'string' || typeof dataFim !== 'string' || !PADRAO_DATA.test(dataInicio) || !PADRAO_DATA.test(dataFim)) {
    return res.status(400).json({ error: 'Período inválido' });
  }
  if (accountIds !== undefined && (!Array.isArray(accountIds) || !accountIds.every((id) => typeof id === 'string' && PADRAO_UUID.test(id)))) {
    return res.status(400).json({ error: 'Contas inválidas' });
  }

  const accountIdsFiltro: string[] | undefined = Array.isArray(accountIds) && accountIds.length > 0 ? accountIds : undefined;

  try {
    const supabaseAdmin = criarSupabaseAdminClient();
    const idsContasInativas = accountIdsFiltro ? [] : await buscarIdsContasInativas(supabaseAdmin);

    const usuarios = await obterUsuariosDoPeriodoGa4(supabaseAdmin, { dataInicio, dataFim, accountIds: accountIdsFiltro, idsContasInativas });
    return res.status(200).json({ usuarios });
  } catch (erro) {
    console.error('Falha ao buscar usuários do período no GA4:', erro instanceof Error ? erro.message : erro);
    return res.status(502).json({ error: 'Falha ao consultar o GA4' });
  }
}
