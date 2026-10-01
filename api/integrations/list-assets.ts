import type { VercelRequest, VercelResponse } from '@vercel/node';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { autenticarUsuario } from '../_lib/auth.js';
import { refreshCredentialsIfNeeded as refreshGa4, obterCredenciais as obterCredenciaisGa4 } from '../../src/integrations/ga4/auth.js';
import { listarPropriedadesDisponiveis } from '../../src/integrations/ga4/fetch.js';
import { refreshCredentialsIfNeeded as refreshGoogleAds, obterCredenciais as obterCredenciaisGoogleAds } from '../../src/integrations/google-ads/auth.js';
import { listarContasDisponiveis } from '../../src/integrations/google-ads/fetch.js';

/**
 * Lista os ativos (propriedades GA4 / identificadores de conversão RD Station
 * / contas Google Ads encontradas na planilha) disponíveis para uma
 * integração já com credencial salva, junto com o que já está selecionado —
 * usado pela etapa 2 do fluxo de conexão (AssetSelectionDialog).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuarioId = await autenticarUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { integrationId, accountId } = req.body ?? {};
  if (!integrationId || typeof integrationId !== 'string') {
    return res.status(400).json({ error: 'integrationId inválido' });
  }
  if (accountId !== undefined && accountId !== null && typeof accountId !== 'string') {
    return res.status(400).json({ error: 'accountId inválido' });
  }

  const supabaseAdmin = criarSupabaseAdminClient();
  const { data: integracao, error: erroIntegracao } = await supabaseAdmin
    .from('integrations')
    .select('key, account_id')
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
      // Não existe endpoint na API do RD Station pra listar formulários/LPs
      // com antecedência — "disponíveis" aqui é o que já chegou de verdade
      // via webhook (integration_discovered_assets), não uma amostra da API.
      const { data: descobertos, error: erroDescobertos } = await supabaseAdmin
        .from('integration_discovered_assets')
        .select('external_id, name')
        .eq('integration_id', integrationId)
        .order('first_seen_at', { ascending: true });
      if (erroDescobertos) throw new Error(erroDescobertos.message);

      // Numa integração compartilhada, cada conta tem sua PRÓPRIA seleção,
      // independente das outras contas — por isso filtra por account_id.
      // Numa integração exclusiva, a seleção sempre foi (e continua sendo)
      // uma só, gravada com account_id null (migration 047).
      const compartilhada = integracao.account_id === null;
      const contaDoEscopo = compartilhada ? (accountId ?? null) : null;

      let consultaSelecionados = supabaseAdmin.from('integration_selected_assets').select('external_id').eq('integration_id', integrationId);
      consultaSelecionados = contaDoEscopo ? consultaSelecionados.eq('account_id', contaDoEscopo) : consultaSelecionados.is('account_id', null);
      const { data: linhasSelecionadas, error: erroSelecionadas } = await consultaSelecionados;
      if (erroSelecionadas) throw new Error(erroSelecionadas.message);

      return res.status(200).json({
        ativos: (descobertos ?? []).map((linha) => ({ externalId: linha.external_id, name: linha.name ?? linha.external_id })),
        selecionados: (linhasSelecionadas ?? []).map((linha) => linha.external_id as string),
        selecaoUnica: false,
      });
    }

    if (integracao.key === 'google_ads') {
      await refreshGoogleAds(integrationId);
      const credenciais = await obterCredenciaisGoogleAds(integrationId);
      const ativos = await listarContasDisponiveis(credenciais);
      return res.status(200).json({
        ativos,
        selecionados: credenciais.customerId ? [credenciais.customerId] : [],
        selecaoUnica: true,
      });
    }

    return res.status(400).json({ error: 'Esta integração não tem seleção de ativos' });
  } catch (erro) {
    console.error('Falha ao listar ativos disponíveis:', erro instanceof Error ? erro.message : erro);
    return res.status(500).json({ error: erro instanceof Error ? erro.message : 'Falha ao listar ativos disponíveis' });
  }
}
