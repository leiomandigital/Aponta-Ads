import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveConnector } from './registry.js';
import type { IntegrationKey, SyncResult } from './types.js';

const DIAS_DE_BACKFILL = 180;
// 180 dias de uma vez estoura o limite de tempo de execução da função na
// Vercel (confirmado: mesmo com as sub-buscas de uma integração já rodando
// em paralelo, uma janela de 180 dias ainda não coube em 60s). A saída é
// buscar em etapas de 60 dias, da mais recente para a mais antiga — assim o
// dashboard já mostra dado atual depois da 1ª etapa, enquanto o histórico
// mais antigo termina de chegar nas etapas seguintes.
const DIAS_POR_ETAPA = 30;

function formatarData(data: Date): string {
  return data.toISOString().slice(0, 10);
}

// "Hoje" já conta como o 1º dos 180 dias (não o 181º) — a data mais antiga
// que 180 dias alcança é hoje - 179, não hoje - 180. Sem esse -1, 3 etapas
// de 60 dias (180 dias cobertos de verdade) nunca batiam exatamente com
// este limite, sobrando sempre uma 4ª etapa de 1 dia só.
function dataLimiteDoBackfill(hoje: Date): string {
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - (DIAS_DE_BACKFILL - 1));
  return formatarData(limite);
}

interface JanelaDeSincronizacao {
  sinceDate: string;
  untilDate: string;
  isBackfill: boolean;
}

/**
 * Decide a janela de datas da próxima chamada: ciclo incremental normal
 * (a partir de ontem) quando o backfill já terminou alguma vez, ou a
 * próxima etapa de 60 dias — da mais recente para a mais antiga — enquanto
 * ainda não alcançou o limite de 180 dias.
 */
function calcularJanela(lastSyncedAt: string | null, backfillCursor: string | null): JanelaDeSincronizacao {
  const hoje = new Date();

  if (lastSyncedAt) {
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    return { sinceDate: formatarData(ontem), untilDate: formatarData(hoje), isBackfill: false };
  }

  const fimDaEtapa = new Date(hoje);
  if (backfillCursor) {
    // a etapa anterior já cobriu até backfillCursor (inclusive) — a próxima
    // etapa continua um dia antes disso, nunca repetindo o que já foi buscado.
    fimDaEtapa.setTime(new Date(`${backfillCursor}T00:00:00`).getTime());
    fimDaEtapa.setDate(fimDaEtapa.getDate() - 1);
  }

  const inicioDaEtapa = new Date(fimDaEtapa);
  inicioDaEtapa.setDate(inicioDaEtapa.getDate() - (DIAS_POR_ETAPA - 1));

  const limite = new Date(`${dataLimiteDoBackfill(hoje)}T00:00:00`);
  const inicioFinal = inicioDaEtapa < limite ? limite : inicioDaEtapa;

  return { sinceDate: formatarData(inicioFinal), untilDate: formatarData(fimDaEtapa), isBackfill: true };
}

/**
 * Executa a sincronização de uma única integração: resolve o conector,
 * renova credenciais, roda sync() para a janela de datas certa (ciclo
 * incremental ou a próxima etapa do backfill de 180 dias), grava sync_logs
 * e atualiza integrations.status/last_synced_at/backfill_cursor. Nunca
 * lança para o chamador — toda falha é capturada e registrada, para
 * dispatch.ts poder usar Promise.allSettled sem que uma integração derrube
 * as outras.
 */
export async function executarSincronizacao(
  supabaseAdmin: SupabaseClient,
  integrationKey: IntegrationKey
): Promise<SyncResult> {
  const iniciadoEm = new Date().toISOString();

  const { data: integracao, error: erroIntegracao } = await supabaseAdmin
    .from('integrations')
    .select('last_synced_at, backfill_cursor')
    .eq('key', integrationKey)
    .single();

  if (erroIntegracao) {
    throw new Error(`Integração "${integrationKey}" não encontrada: ${erroIntegracao.message}`);
  }

  const janela = calcularJanela(integracao.last_synced_at, integracao.backfill_cursor);

  let resultado: SyncResult;

  try {
    const connector = resolveConnector(integrationKey);
    await connector.refreshCredentialsIfNeeded();
    resultado = await connector.sync({ isBackfill: janela.isBackfill, sinceDate: janela.sinceDate, untilDate: janela.untilDate });
  } catch (erro) {
    resultado = {
      status: 'error',
      recordsSynced: 0,
      errorMessage: erro instanceof Error ? erro.message : 'Falha desconhecida na sincronização',
    };
  }

  await supabaseAdmin.from('sync_logs').insert({
    integration_key: integrationKey,
    started_at: iniciadoEm,
    finished_at: new Date().toISOString(),
    status: resultado.status,
    records_synced: resultado.recordsSynced,
    error_message: resultado.errorMessage ?? null,
    details: resultado.details ?? null,
  });

  const atualizacao: Record<string, unknown> = {
    status: resultado.status === 'error' ? 'error' : 'connected',
    updated_at: new Date().toISOString(),
  };

  // 'error' preserva last_synced_at/backfill_cursor como estavam, para a
  // PRÓXIMA tentativa repetir a MESMA janela em vez de perder a etapa.
  if (resultado.status !== 'error') {
    if (!janela.isBackfill) {
      atualizacao.last_synced_at = new Date().toISOString();
    } else if (janela.sinceDate <= dataLimiteDoBackfill(new Date())) {
      // esta etapa alcançou os 180 dias — backfill concluído, vira ciclo incremental.
      atualizacao.last_synced_at = new Date().toISOString();
      atualizacao.backfill_cursor = null;
    } else {
      atualizacao.backfill_cursor = janela.sinceDate;
      resultado.maisEtapas = true;
    }
  }

  await supabaseAdmin.from('integrations').update(atualizacao).eq('key', integrationKey);

  return resultado;
}
