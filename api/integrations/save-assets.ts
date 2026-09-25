import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { autenticarUsuario } from '../_lib/auth.js';
import { salvarCredenciais } from '../../src/integrations/credentialsVault.js';
import { obterCredenciais as obterCredenciaisGa4, type GA4Credentials } from '../../src/integrations/ga4/auth.js';

interface AtivoSelecionado {
  externalId: string;
  name: string;
}

/**
 * Grava a seleção de ativos feita na etapa 2 do fluxo de conexão. GA4 é
 * seleção única: o externalId escolhido vira o propertyId dentro da própria
 * credencial (não usa integration_selected_assets — ver decisão na migration
 * 033/plano de implementação, evita duas fontes de verdade pra GA4). RD
 * Station é seleção múltipla de verdade: grava em integration_selected_assets,
 * substituindo o que existia (diff completo, não incremental).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuarioId = await autenticarUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { integrationId, selectedAssets } = req.body ?? {};
  if (!integrationId || typeof integrationId !== 'string') {
    return res.status(400).json({ error: 'integrationId inválido' });
  }
  if (!Array.isArray(selectedAssets)) {
    return res.status(400).json({ error: 'selectedAssets inválido' });
  }

  const supabaseAdmin = criarSupabaseAdminClient();
  const { data: integracao, error: erroIntegracao } = await supabaseAdmin
    .from('integrations')
    .select('key')
    .eq('id', integrationId)
    .maybeSingle();

  if (erroIntegracao) return res.status(500).json({ error: erroIntegracao.message });
  if (!integracao) return res.status(404).json({ error: 'Integração não encontrada' });

  const ativos = selectedAssets as AtivoSelecionado[];

  try {
    if (integracao.key === 'ga4') {
      const credenciaisAtuais = await obterCredenciaisGa4(integrationId);
      const novaCredencial: GA4Credentials = { ...credenciaisAtuais, propertyId: ativos[0]?.externalId ?? '' };
      await salvarCredenciais(integrationId, { ...novaCredencial });
      return res.status(200).json({ ok: true });
    }

    if (integracao.key === 'rd_station') {
      const { error: erroRemocao } = await supabaseAdmin.from('integration_selected_assets').delete().eq('integration_id', integrationId);
      if (erroRemocao) throw new Error(erroRemocao.message);

      if (ativos.length > 0) {
        const { error: erroInsercao } = await supabaseAdmin.from('integration_selected_assets').insert(
          ativos.map((ativo) => ({ integration_id: integrationId, external_id: ativo.externalId, name: ativo.name }))
        );
        if (erroInsercao) throw new Error(erroInsercao.message);
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Esta integração não tem seleção de ativos' });
  } catch (erro) {
    console.error('Falha ao salvar seleção de ativos:', erro instanceof Error ? erro.message : erro);
    return res.status(500).json({ error: erro instanceof Error ? erro.message : 'Falha ao salvar seleção de ativos' });
  }
}
