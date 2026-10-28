import type { SupabaseClient } from '@supabase/supabase-js';
import { filtroDeConta } from '../../services/dashboardQueries.js';
import type { UsuariosDoPeriodo } from '../../utils/metricsAggregation.js';
import { obterCredenciais, refreshCredentialsIfNeeded, type GA4Credentials } from './auth.js';
import { buscarUsuariosDoPeriodo } from './fetch.js';

interface FiltrosUsuarios {
  dataInicio: string;
  dataFim: string;
  accountIds?: string[];
  idsContasInativas?: string[];
}

/**
 * Usuários únicos do período, direto do GA4 das contas em visualização (as mesmas que o dashboard soma).
 * Existe porque o total de usuários de um período não sai da soma dos usuários de cada dia: quem volta em outro dia
 * seria contado de novo. Devolve null quando nenhuma integração do GA4 tem propriedade selecionada.
 */
export async function obterUsuariosDoPeriodoGa4(
  supabaseAdmin: SupabaseClient,
  filtros: FiltrosUsuarios
): Promise<UsuariosDoPeriodo | null> {
  let consulta = supabaseAdmin.from('integrations').select('id').eq('key', 'ga4').eq('is_active', true);
  const filtroConta = filtroDeConta(filtros.accountIds, filtros.idsContasInativas);
  if (filtroConta) consulta = consulta.or(filtroConta);

  const { data: integracoes, error } = await consulta;
  if (error) throw new Error(error.message);

  const credenciais = await Promise.all(
    (integracoes ?? []).map(async ({ id }) => {
      await refreshCredentialsIfNeeded(id as string);
      return obterCredenciais(id as string);
    })
  );

  // Uma consulta por propriedade: duas integrações apontando para a mesma propriedade contariam a mesma gente duas vezes.
  const porPropriedade = new Map<string, GA4Credentials>();
  for (const credencial of credenciais) {
    if (credencial.propertyId && !porPropriedade.has(credencial.propertyId)) porPropriedade.set(credencial.propertyId, credencial);
  }
  if (porPropriedade.size === 0) return null;

  const resultados = await Promise.all(
    [...porPropriedade.values()].map((credencial) => buscarUsuariosDoPeriodo(credencial, filtros.dataInicio, filtros.dataFim))
  );

  // Propriedades diferentes têm públicos diferentes — aí sim soma.
  const soma: UsuariosDoPeriodo = { total: 0, porDispositivo: {} };
  for (const resultado of resultados) {
    soma.total += resultado.total;
    for (const [dispositivo, usuarios] of Object.entries(resultado.porDispositivo)) {
      soma.porDispositivo[dispositivo] = (soma.porDispositivo[dispositivo] ?? 0) + usuarios;
    }
  }
  return soma;
}
