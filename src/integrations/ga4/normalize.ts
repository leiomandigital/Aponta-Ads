import type { SupabaseClient } from '@supabase/supabase-js';
import { paraDataSaoPaulo } from '../timezone.js';
import { intervaloDeDatas, linhasParaGravar } from '../diffUpsert.js';
import type { GA4Row } from './fetch.js';

// Ordem fixa das dimensões pedidas em fetch.ts: date, pagePath, deviceCategory, sessionDefaultChannelGroup
const INDICE_DATA = 0;
const INDICE_PAGE_PATH = 1;
const INDICE_DEVICE = 2;
const INDICE_TRAFFIC_TYPE = 3;

const INDICE_SESSIONS = 0;
const INDICE_USERS = 1;
const INDICE_EVENT_COUNT = 0; // consulta de leads tem uma única métrica

const COLUNAS_CONFLITO = 'date,page_path,device,age_range,gender,traffic_type,account_id';
const COLUNAS_CHAVE = ['date', 'page_path', 'device', 'age_range', 'gender', 'traffic_type', 'account_id'];

function normalizarDimensoes(dimensoes: GA4Row['dimensionValues']) {
  // GA4 devolve a data como YYYYMMDD, já na configuração de fuso da própria propriedade —
  // reformatamos para YYYY-MM-DD e então normalizamos para America/Sao_Paulo.
  const dataBruta = dimensoes[INDICE_DATA]?.value ?? '';
  const dataIso = `${dataBruta.slice(0, 4)}-${dataBruta.slice(4, 6)}-${dataBruta.slice(6, 8)}`;

  return {
    date: paraDataSaoPaulo(dataIso),
    page_path: dimensoes[INDICE_PAGE_PATH]?.value || null,
    device: dimensoes[INDICE_DEVICE]?.value || null,
    age_range: null,
    gender: null,
    traffic_type: dimensoes[INDICE_TRAFFIC_TYPE]?.value || null,
  };
}

type Dimensoes = ReturnType<typeof normalizarDimensoes>;

const chaveDe = (d: Dimensoes) => [d.date, d.page_path, d.device, d.traffic_type].join('|');

/**
 * Grava sessões/usuários e, quando `linhasLeads` é informado, os leads na mesma linha.
 * `linhasLeads` undefined significa que a consulta de leads falhou: a coluna `leads`
 * não é enviada, para não zerar o que já estava gravado.
 */
export async function normalizarEGravarSessoes(
  supabaseAdmin: SupabaseClient,
  linhas: GA4Row[],
  accountId: string | null,
  linhasLeads?: GA4Row[]
): Promise<number> {
  if (linhas.length === 0 && !linhasLeads?.length) return 0;

  const leadsPorChave = new Map<string, { dimensoes: Dimensoes; leads: number }>();
  for (const linha of linhasLeads ?? []) {
    const dimensoes = normalizarDimensoes(linha.dimensionValues);
    const chave = chaveDe(dimensoes);
    const acumulado = leadsPorChave.get(chave)?.leads ?? 0;
    leadsPorChave.set(chave, { dimensoes, leads: acumulado + Number(linha.metricValues[INDICE_EVENT_COUNT]?.value ?? 0) });
  }

  const chavesComSessao = new Set<string>();
  const linhasNormalizadas = linhas.map((linha) => {
    const dimensoes = normalizarDimensoes(linha.dimensionValues);
    const chave = chaveDe(dimensoes);
    chavesComSessao.add(chave);

    return {
      ...dimensoes,
      sessions: Number(linha.metricValues[INDICE_SESSIONS]?.value ?? 0),
      users: Number(linha.metricValues[INDICE_USERS]?.value ?? 0),
      ...(linhasLeads ? { leads: leadsPorChave.get(chave)?.leads ?? 0 } : {}),
      // Região de sessão do GA4 depende de UTM de campanha padronizado (trabalho
      // operacional do Sam, ainda em andamento) — fica null até essa estruturação
      // estar concluída. Ver Arquitetura, seção 5, migration 015.
      region: null,
      account_id: accountId,
    };
  });

  // Lead sem linha de sessão correspondente: grava só a coluna `leads`, para não
  // sobrescrever sessions/users de uma linha que já exista com zero.
  const linhasSoDeLeads = [...leadsPorChave.entries()]
    .filter(([chave]) => !chavesComSessao.has(chave))
    .map(([, { dimensoes, leads }]) => ({ ...dimensoes, leads, region: null, account_id: accountId }));

  const todasAsDatas = [...linhasNormalizadas, ...linhasSoDeLeads].map((linha) => linha.date);
  if (todasAsDatas.length === 0) return 0;

  const { min, max } = intervaloDeDatas(todasAsDatas);
  let consultaExistentes = supabaseAdmin
    .from('analytics_sessions_daily')
    .select('date, page_path, device, age_range, gender, traffic_type, account_id, sessions, users, leads, region')
    .gte('date', min)
    .lte('date', max);
  consultaExistentes = accountId ? consultaExistentes.eq('account_id', accountId) : consultaExistentes.is('account_id', null);

  const { data: existentes, error: erroExistentes } = await consultaExistentes;
  if (erroExistentes) throw new Error(erroExistentes.message);

  let totalGravado = 0;

  if (linhasNormalizadas.length > 0) {
    // leads só entra na comparação quando a linha de fato carrega essa coluna
    // (linhasLeads informado) — senão toda linha pareceria "diferente" da
    // existente por causa de um campo que nem foi buscado desta vez.
    const colunasValor = linhasLeads ? ['sessions', 'users', 'leads', 'region'] : ['sessions', 'users', 'region'];
    const paraGravar = linhasParaGravar(linhasNormalizadas, existentes ?? [], COLUNAS_CHAVE, colunasValor);

    if (paraGravar.length > 0) {
      const { error } = await supabaseAdmin.from('analytics_sessions_daily').upsert(paraGravar, { onConflict: COLUNAS_CONFLITO });
      if (error) throw new Error(error.message);
    }
    totalGravado += paraGravar.length;
  }

  if (linhasSoDeLeads.length > 0) {
    const paraGravar = linhasParaGravar(linhasSoDeLeads, existentes ?? [], COLUNAS_CHAVE, ['leads', 'region']);

    if (paraGravar.length > 0) {
      const { error } = await supabaseAdmin.from('analytics_sessions_daily').upsert(paraGravar, { onConflict: COLUNAS_CONFLITO });
      if (error) throw new Error(error.message);
    }
    totalGravado += paraGravar.length;
  }

  return totalGravado;
}
