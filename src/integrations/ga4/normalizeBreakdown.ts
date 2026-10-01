import type { SupabaseClient } from '@supabase/supabase-js';
import { paraDataSaoPaulo } from '../timezone.js';
import { intervaloDeDatas, linhasParaGravar } from '../diffUpsert.js';
import type { ResultadoDetalhamentoLead, TipoDetalhamentoLead } from './fetch.js';

const COLUNAS_CONFLITO = 'date,kind,dim1,dim2,dim3,account_id';
const COLUNAS_CHAVE = ['date', 'kind', 'dim1', 'dim2', 'dim3', 'account_id'];
const TAMANHO_LOTE_UPSERT = 1000;
const TAMANHO_PAGINA_LEITURA = 1000;
const MS_POR_DIA = 86400000;

interface LinhaDetalhamento extends Record<string, unknown> {
  date: string;
  kind: TipoDetalhamentoLead;
  dim1: string | null;
  dim2: string | null;
  dim3: string | null;
  leads: number;
  account_id: string | null;
}

function dataGa4ParaIso(valor: string): string {
  return `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}`;
}

function valorOuNulo(valor: string | undefined): string | null {
  // "(not set)" é o GA4 dizendo "sem dado" — vira null e o dashboard rotula como "(não identificado)".
  return !valor || valor === '(not set)' ? null : valor;
}

/**
 * Converte as linhas do GA4 de uma consulta em linhas de analytics_lead_breakdown_daily.
 * Linhas com o mesmo (data, dim1, dim2, dim3) são somadas — a mesma chave pode aparecer mais
 * de uma vez depois de normalizar "(not set)" para null ou de agrupar dias.
 */
function normalizarConsulta(resultado: Extract<ResultadoDetalhamentoLead, { ok: true }>, accountId: string | null): LinhaDetalhamento[] {
  const acumulado = new Map<string, LinhaDetalhamento>();

  for (const linha of resultado.linhas) {
    const dimensoes = linha.dimensionValues.map((d) => d.value);
    const data = paraDataSaoPaulo(dataGa4ParaIso(dimensoes[0] ?? ''));
    let dim1: string | null;
    let dim2: string | null = null;
    let dim3: string | null = null;

    if (resultado.tipo === 'tempo') {
      // dias entre a 1ª visita do usuário e o dia do lead — o dashboard agrupa em faixas
      const primeira = dimensoes[1] && dimensoes[1] !== '(not set)' ? dataGa4ParaIso(dimensoes[1]) : null;
      const dias = primeira ? Math.max(0, Math.round((new Date(`${data}T00:00:00Z`).getTime() - new Date(`${primeira}T00:00:00Z`).getTime()) / MS_POR_DIA)) : null;
      dim1 = dias === null ? null : String(dias);
    } else {
      dim1 = valorOuNulo(dimensoes[1]);
      dim2 = valorOuNulo(dimensoes[2]);
      dim3 = valorOuNulo(dimensoes[3]);
    }

    const leads = Number(linha.metricValues[0]?.value ?? 0);
    const chave = [data, dim1, dim2, dim3].join('|');
    const atual = acumulado.get(chave);
    if (atual) atual.leads += leads;
    else acumulado.set(chave, { date: data, kind: resultado.tipo, dim1, dim2, dim3, leads, account_id: accountId });
  }

  return [...acumulado.values()];
}

async function buscarExistentes(supabaseAdmin: SupabaseClient, tipo: TipoDetalhamentoLead, accountId: string | null, min: string, max: string) {
  const existentes: LinhaDetalhamento[] = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA_LEITURA) {
    let consulta = supabaseAdmin
      .from('analytics_lead_breakdown_daily')
      .select('date, kind, dim1, dim2, dim3, leads, account_id')
      .eq('kind', tipo)
      .gte('date', min)
      .lte('date', max)
      .range(inicio, inicio + TAMANHO_PAGINA_LEITURA - 1);
    consulta = accountId ? consulta.eq('account_id', accountId) : consulta.is('account_id', null);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    existentes.push(...((data ?? []) as LinhaDetalhamento[]));
    if ((data ?? []).length < TAMANHO_PAGINA_LEITURA) break;
  }
  return existentes;
}

/**
 * Grava o detalhamento de leads (insere o que é novo, atualiza o que mudou, ignora o igual —
 * mesma regra de diffUpsert.ts). Devolve o resultado por tipo, para o sync mostrar quais
 * dimensões deram certo (ex.: idade/gênero podem falhar sem Google Signals).
 */
export async function normalizarEGravarDetalhamentoLeads(
  supabaseAdmin: SupabaseClient,
  resultados: ResultadoDetalhamentoLead[],
  accountId: string | null
): Promise<{ gravados: number; detalhes: Record<string, string> }> {
  let gravados = 0;
  const detalhes: Record<string, string> = {};

  for (const resultado of resultados) {
    const rotulo = `analytics_lead_${resultado.tipo}`;
    if (!resultado.ok) {
      detalhes[rotulo] = `error: ${resultado.erro}`;
      continue;
    }

    try {
      const linhas = normalizarConsulta(resultado, accountId);
      if (linhas.length > 0) {
        const { min, max } = intervaloDeDatas(linhas.map((linha) => linha.date));
        const existentes = await buscarExistentes(supabaseAdmin, resultado.tipo, accountId, min, max);
        const paraGravar = linhasParaGravar(linhas, existentes, COLUNAS_CHAVE, ['leads']);

        for (let inicio = 0; inicio < paraGravar.length; inicio += TAMANHO_LOTE_UPSERT) {
          const { error } = await supabaseAdmin
            .from('analytics_lead_breakdown_daily')
            .upsert(paraGravar.slice(inicio, inicio + TAMANHO_LOTE_UPSERT), { onConflict: COLUNAS_CONFLITO });
          if (error) throw new Error(error.message);
        }
        gravados += paraGravar.length;
      }
      detalhes[rotulo] = 'success';
    } catch (erro) {
      detalhes[rotulo] = `error: ${erro instanceof Error ? erro.message : 'falha desconhecida'}`;
    }
  }

  return { gravados, detalhes };
}
