import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { autenticarUsuario } from '../_lib/auth.js';

/**
 * Lista/grava o link público de cada identificador já descoberto do RD
 * Station (integration_discovered_assets.link_url) — a RD Station não
 * expõe essa URL nem via API nem no export de leads (confirmado testando),
 * então é preenchido manualmente aqui. É por INTEGRAÇÃO, não por conta —
 * o link do formulário é o mesmo independente de qual conta o importa.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const usuarioId = await autenticarUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabaseAdmin = criarSupabaseAdminClient();

  if (req.method === 'GET') {
    const integrationId = typeof req.query.integrationId === 'string' ? req.query.integrationId : undefined;
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId inválido' });
    }

    const { data, error } = await supabaseAdmin
      .from('integration_discovered_assets')
      .select('external_id, name, link_url')
      .eq('integration_id', integrationId)
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      links: (data ?? []).map((linha) => ({
        externalId: linha.external_id as string,
        name: (linha.name as string | null) ?? (linha.external_id as string),
        linkUrl: linha.link_url as string | null,
      })),
    });
  }

  if (req.method === 'POST') {
    const { integrationId, links } = req.body ?? {};
    if (!integrationId || typeof integrationId !== 'string') {
      return res.status(400).json({ error: 'integrationId inválido' });
    }
    if (!Array.isArray(links)) {
      return res.status(400).json({ error: 'links inválido' });
    }

    const linhas = links as Array<{ externalId: string; linkUrl: string | null }>;
    if (linhas.length === 0) {
      return res.status(200).json({ ok: true });
    }

    // Só atualiza link_url (onConflict com objeto sem `name` não mexe nas
    // outras colunas) — as linhas já existem, vieram da descoberta via
    // webhook/importação, nunca são criadas por aqui.
    const { error } = await supabaseAdmin.from('integration_discovered_assets').upsert(
      linhas.map((linha) => ({
        integration_id: integrationId,
        external_id: linha.externalId,
        link_url: linha.linkUrl?.trim() || null,
      })),
      { onConflict: 'integration_id,external_id' }
    );
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
