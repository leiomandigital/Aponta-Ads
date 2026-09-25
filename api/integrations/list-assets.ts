import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { autenticarUsuario } from '../_lib/auth.js';
import { refreshCredentialsIfNeeded as refreshGa4, obterCredenciais as obterCredenciaisGa4 } from '../../src/integrations/ga4/auth.js';
import { listarPropriedadesDisponiveis } from '../../src/integrations/ga4/fetch.js';
import { refreshCredentialsIfNeeded as refreshRd, obterCredenciais as obterCredenciaisRd } from '../../src/integrations/rd-station/auth.js';
import { listarIdentificadoresDisponiveis } from '../../src/integrations/rd-station/fetch.js';

/**
 * Lista os ativos (propriedades GA4 / identificadores de conversão RD Station)
 * disponíveis para uma integração já com credencial salva, junto com o que já
 * está selecionado — usado pela etapa 2 do fluxo de conexão (AssetSelectionDialog).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuarioId = await autenticarUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { integrationId } = req.body ?? {};
  if (!integrationId || typeof integrationId !== 'string') {
    return res.status(400).json({ error: 'integrationId inválido' });
  }

  const supabaseAdmin = criarSupabaseAdminClient();
  const { data: integracao, error: erroIntegracao } = await supabaseAdmin
    .from('integrations')
    .select('key')
    .eq('id', integrationId)
    .maybeSingle();

  if (erroIntegracao) return res.status(500).json({ error: erroIntegracao.message });
  if (!integracao) return res.status(404).json({ error: 'Integração não encontrada' });

  try {
    if (integracao.key === 'ga4') {
      await refreshGa4(integrationId);
      const credenciais = await obterCredenciaisGa4(integrationId);
      const ativos = await listarPropriedadesDisponiveis(credenciais);
      return res.status(200).json({
        ativos,
        selecionados: credenciais.propertyId ? [credenciais.propertyId] : [],
        selecaoUnica: true,
      });
    }

    if (integracao.key === 'rd_station') {
      await refreshRd(integrationId);
      const credenciais = await obterCredenciaisRd(integrationId);
      const ativos = await listarIdentificadoresDisponiveis(credenciais);

      const { data: linhasSelecionadas, error: erroSelecionadas } = await supabaseAdmin
        .from('integration_selected_assets')
        .select('external_id')
        .eq('integration_id', integrationId);
      if (erroSelecionadas) throw new Error(erroSelecionadas.message);

      return res.status(200).json({
        ativos,
        selecionados: (linhasSelecionadas ?? []).map((linha) => linha.external_id as string),
        selecaoUnica: false,
      });
    }

    return res.status(400).json({ error: 'Esta integração não tem seleção de ativos' });
  } catch (erro) {
    console.error('Falha ao listar ativos disponíveis:', erro instanceof Error ? erro.message : erro);
    return res.status(500).json({ error: erro instanceof Error ? erro.message : 'Falha ao listar ativos disponíveis' });
  }
}
