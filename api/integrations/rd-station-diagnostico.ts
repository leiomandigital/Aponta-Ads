import type { VercelRequest, VercelResponse } from '@vercel/node';
import { autenticarCron, autenticarUsuario } from '../_lib/auth.js';
import { obterCredenciais, refreshCredentialsIfNeeded } from '../../src/integrations/rd-station/auth.js';

/**
 * Endpoint de diagnóstico — lista as assinaturas de webhook cadastradas na
 * RD Station para a integração, usando sempre a credencial ATUAL (o
 * refresh_token rotaciona a cada renovação automática, então testar com um
 * valor copiado manualmente antes fica inválido rápido). Sem isso não tinha
 * como confirmar do lado da RD Station se o webhook foi registrado de
 * verdade sem depender de um token que o próprio usuário não consegue mais
 * obter manualmente.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const autorizado = autenticarCron(req) || !!(await autenticarUsuario(req));
  if (!autorizado) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const integrationId = typeof req.query.integrationId === 'string' ? req.query.integrationId : undefined;
  if (!integrationId) {
    return res.status(400).json({ error: 'integrationId ausente' });
  }

  try {
    await refreshCredentialsIfNeeded(integrationId);
    const credenciais = await obterCredenciais(integrationId);

    const resposta = await fetch('https://api.rd.services/integrations/webhooks', {
      headers: { Authorization: `Bearer ${credenciais.accessToken}` },
    });

    const corpo = await resposta.json().catch(() => null);

    return res.status(200).json({
      webhookSalvoNoApontaAds: { webhookUuid: credenciais.webhookUuid ?? null, webhookSecret: credenciais.webhookSecret ? 'presente' : 'ausente' },
      respostaRdStation: { status: resposta.status, corpo },
    });
  } catch (erro) {
    return res.status(500).json({ error: erro instanceof Error ? erro.message : 'Falha no diagnóstico' });
  }
}
