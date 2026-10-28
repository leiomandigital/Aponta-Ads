import type { SupabaseClient } from '@supabase/supabase-js';
import { paraDataSaoPaulo } from '../timezone.js';
import { intervaloDeDatas, linhasParaGravar } from '../diffUpsert.js';
import type { GA4Row } from './fetch.js';

// Ordem fixa das dimensões pedidas em buscarTrafego (fetch.ts): date, deviceCategory
const INDICE_DATA = 0;
const INDICE_DEVICE = 1;

const INDICE_SESSIONS = 0;
const INDICE_USERS = 1;

const COLUNAS_CONFLITO = 'date,device,account_id';
const COLUNAS_CHAVE = ['date', 'device', 'account_id'];

interface LinhaTrafego extends Record<string, unknown> {
  date: string;
  device: string | null;
  sessions: number;
  users: number;
  account_id: string | null;
}

/**
 * Grava sessões e usuários por dia e dispositivo (sem página) em analytics_traffic_daily — a base dos totais de
 * sessões do dashboard e do PDF. Ver a migration 057 para o porquê de não somar as linhas por página.
 */
export async function normalizarEGravarTrafego(supabaseAdmin: SupabaseClient, linhas: GA4Row[], accountId: string | null): Promise<number> {
  if (linhas.length === 0) return 0;

  // A mesma chave pode repetir depois de normalizar a data — soma em vez de deixar o upsert sobrescrever.
  const acumulado = new Map<string, LinhaTrafego>();
  for (const linha of linhas) {
    // GA4 devolve a data como YYYYMMDD, já no fuso da própria propriedade — reformata e normaliza para America/Sao_Paulo.
    const dataBruta = linha.dimensionValues[INDICE_DATA]?.value ?? '';
    const date = paraDataSaoPaulo(`${dataBruta.slice(0, 4)}-${dataBruta.slice(4, 6)}-${dataBruta.slice(6, 8)}`);
    const device = linha.dimensionValues[INDICE_DEVICE]?.value || null;
    const sessions = Number(linha.metricValues[INDICE_SESSIONS]?.value ?? 0);
    const users = Number(linha.metricValues[INDICE_USERS]?.value ?? 0);

    const chave = `${date}|${device}`;
    const anterior = acumulado.get(chave);
    acumulado.set(chave, {
      date,
      device,
      sessions: (anterior?.sessions ?? 0) + sessions,
      users: (anterior?.users ?? 0) + users,
      account_id: accountId,
    });
  }

  const linhasNormalizadas = [...acumulado.values()];
  const { min, max } = intervaloDeDatas(linhasNormalizadas.map((linha) => linha.date));

  let consultaExistentes = supabaseAdmin
    .from('analytics_traffic_daily')
    .select('date, device, account_id, sessions, users')
    .gte('date', min)
    .lte('date', max);
  consultaExistentes = accountId ? consultaExistentes.eq('account_id', accountId) : consultaExistentes.is('account_id', null);

  const { data: existentes, error: erroExistentes } = await consultaExistentes;
  if (erroExistentes) throw new Error(erroExistentes.message);

  const paraGravar = linhasParaGravar(linhasNormalizadas, (existentes ?? []) as LinhaTrafego[], COLUNAS_CHAVE, ['sessions', 'users']);
  if (paraGravar.length === 0) return 0;

  const { error } = await supabaseAdmin.from('analytics_traffic_daily').upsert(paraGravar, { onConflict: COLUNAS_CONFLITO });
  if (error) throw new Error(error.message);

  return paraGravar.length;
}
