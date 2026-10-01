import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PostgrestError } from '@supabase/supabase-js';
import { criarSupabaseAdminClient } from '../../src/lib/supabaseAdminClient.js';
import { autenticarUsuario } from '../_lib/auth.js';
import { salvarCredenciais } from '../../src/integrations/credentialsVault.js';
import { obterCredenciais as obterCredenciaisGa4, type GA4Credentials } from '../../src/integrations/ga4/auth.js';
import { obterCredenciais as obterCredenciaisGoogleAds, type GoogleAdsCredentials } from '../../src/integrations/google-ads/auth.js';
import { normalizarEGravarLeads, type RDStationWebhookLead } from '../../src/integrations/rd-station/normalize.js';

interface AtivoSelecionado {
  externalId: string;
  name: string;
}

// error.message sozinho geralmente omite a causa real (nome da constraint
// violada, coluna com tipo errado, etc.) — details/hint/code do Postgrest
// carregam isso; sem eles o cliente só via "Bad Request" genérico.
function formatarErroSupabase(erro: PostgrestError): string {
  return [erro.message, erro.details, erro.hint, erro.code].filter(Boolean).join(' | ');
}

/**
 * Grava a seleção de ativos feita na etapa 2 do fluxo de conexão. GA4 e
 * Google Ads são seleção única: o externalId escolhido vira o propertyId/
 * customerId dentro da própria credencial (não usa integration_selected_assets
 * — ver decisão na migration 033/plano de implementação, evita duas fontes de
 * verdade). RD Station é seleção múltipla de verdade: grava em
 * integration_selected_assets, substituindo o que existia (diff completo,
 * não incremental).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const usuarioId = await autenticarUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { integrationId, accountId, selectedAssets } = req.body ?? {};
  if (!integrationId || typeof integrationId !== 'string') {
    return res.status(400).json({ error: 'integrationId inválido' });
  }
  if (accountId !== undefined && accountId !== null && typeof accountId !== 'string') {
    return res.status(400).json({ error: 'accountId inválido' });
  }
  if (!Array.isArray(selectedAssets)) {
    return res.status(400).json({ error: 'selectedAssets inválido' });
  }

  const supabaseAdmin = criarSupabaseAdminClient();
  const { data: integracao, error: erroIntegracao } = await supabaseAdmin
    .from('integrations')
    .select('key, account_id')
    .eq('id', integrationId)
    .maybeSingle();

  if (erroIntegracao) return res.status(500).json({ error: formatarErroSupabase(erroIntegracao) });
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
      // Integração compartilhada: cada conta tem sua PRÓPRIA seleção,
      // independente das outras — a seleção salva aqui vale só pra
      // accountId (a conta que estava sendo configurada na tela). Integração
      // exclusiva: sempre existiu (e continua) uma seleção só, com
      // account_id null (migration 047).
      const compartilhada = integracao.account_id === null;
      const contaDoEscopo: string | null = compartilhada ? (accountId ?? null) : null;

      let consultaAnterior = supabaseAdmin.from('integration_selected_assets').select('external_id').eq('integration_id', integrationId);
      consultaAnterior = contaDoEscopo ? consultaAnterior.eq('account_id', contaDoEscopo) : consultaAnterior.is('account_id', null);
      const { data: selecaoAnterior, error: erroSelecaoAnterior } = await consultaAnterior;
      if (erroSelecaoAnterior) throw new Error(`select seleção anterior: ${formatarErroSupabase(erroSelecaoAnterior)}`);

      const idsAnteriores = new Set((selecaoAnterior ?? []).map((linha) => linha.external_id as string));
      // Só os que passaram a fazer parte da seleção AGORA (nesta conta) —
      // evita regravar (e reaparecer como "novo") um identificador que essa
      // mesma conta já tinha selecionado.
      const idsRecemSelecionados = ativos.map((ativo) => ativo.externalId).filter((id) => !idsAnteriores.has(id));

      let consultaRemocao = supabaseAdmin.from('integration_selected_assets').delete().eq('integration_id', integrationId);
      consultaRemocao = contaDoEscopo ? consultaRemocao.eq('account_id', contaDoEscopo) : consultaRemocao.is('account_id', null);
      const { error: erroRemocao } = await consultaRemocao;
      if (erroRemocao) throw new Error(`delete seleção anterior: ${formatarErroSupabase(erroRemocao)}`);

      if (ativos.length > 0) {
        const { error: erroInsercao } = await supabaseAdmin.from('integration_selected_assets').insert(
          ativos.map((ativo) => ({
            integration_id: integrationId,
            external_id: ativo.externalId,
            name: ativo.name,
            account_id: contaDoEscopo,
          }))
        );
        if (erroInsercao) throw new Error(`insert seleção nova: ${formatarErroSupabase(erroInsercao)}`);
      }

      // Toda conversão de um identificador ainda não selecionado (nesta
      // conta) fica retida em rd_station_pending_leads (webhook handler) —
      // inclusive as que chegaram antes da 1ª aparição na tela de seleção.
      // Agora que o identificador acabou de ser selecionado, grava tudo que
      // tiver acumulado (não só a última) e limpa a fila.
      if (idsRecemSelecionados.length > 0) {
        // Ordem cronológica importa: normalizarEGravarLeads deduplica por
        // (source, external_id) mantendo a ÚLTIMA ocorrência do array — sem
        // isso, se a mesma pessoa converteu mais de uma vez, poderia ficar
        // com dados de uma ocorrência mais antiga.
        const { data: pendentes, error: erroPendentes } = await supabaseAdmin
          .from('rd_station_pending_leads')
          .select('id, payload')
          .eq('integration_id', integrationId)
          .in('external_id', idsRecemSelecionados)
          .order('received_at', { ascending: true });
        if (erroPendentes) throw new Error(`select pendentes: ${formatarErroSupabase(erroPendentes)}`);

        if (pendentes && pendentes.length > 0) {
          const leadsRetroativos = pendentes.map((linha) => linha.payload as RDStationWebhookLead);
          await normalizarEGravarLeads(supabaseAdmin, leadsRetroativos, contaDoEscopo ?? integracao.account_id ?? null);

          // Apaga pelo mesmo filtro usado pra buscar (integration_id +
          // external_id), não por uma lista de ids de linha — identificador
          // com muitas conversões acumuladas (ex.: 1.672 pendentes) gerava um
          // .in('id', [...milhares...]) gigante, estourando limite de
          // tamanho de requisição em produção (não reproduzia testando local
          // com poucas linhas). idsRecemSelecionados é sempre pequeno (nomes
          // de identificador, não linhas), então a URL nunca cresce com o
          // volume de leads.
          const { error: erroLimpeza } = await supabaseAdmin
            .from('rd_station_pending_leads')
            .delete()
            .eq('integration_id', integrationId)
            .in('external_id', idsRecemSelecionados);
          if (erroLimpeza) throw new Error(`delete pendentes: ${formatarErroSupabase(erroLimpeza)}`);
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (integracao.key === 'google_ads') {
      const credenciaisAtuais = await obterCredenciaisGoogleAds(integrationId);
      const novaCredencial: GoogleAdsCredentials = { ...credenciaisAtuais, customerId: ativos[0]?.externalId ?? '' };
      await salvarCredenciais(integrationId, { ...novaCredencial });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Esta integração não tem seleção de ativos' });
  } catch (erro) {
    console.error('Falha ao salvar seleção de ativos:', erro instanceof Error ? erro.message : erro);
    return res.status(500).json({ error: erro instanceof Error ? erro.message : 'Falha ao salvar seleção de ativos' });
  }
}
