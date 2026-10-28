import { supabase } from '@/lib/supabaseClient';
import { criarDashboardQueries, type FiltrosDashboard } from '@/services/dashboardQueries';
import type { UsuariosDoPeriodo } from '@/utils/metricsAggregation';

export type { FiltrosDashboard } from '@/services/dashboardQueries';

export const dashboardService = {
  ...criarDashboardQueries(supabase),

  /**
   * Usuários únicos do período, direto do GA4 (/api/analytics/usuarios) — o total de um período não sai da soma dos
   * usuários de cada dia. Nunca lança: sem sessão, sem GA4 ou com o GA4 fora do ar devolve null e o dashboard mantém
   * a soma dos dias, em vez de quebrar a tela por causa de um número.
   */
  async obterUsuariosDoPeriodo(filtros: Pick<FiltrosDashboard, 'dataInicio' | 'dataFim' | 'accountIds'>): Promise<UsuariosDoPeriodo | null> {
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token) return null;

      const resposta = await fetch('/api/analytics/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dataInicio: filtros.dataInicio, dataFim: filtros.dataFim, accountIds: filtros.accountIds }),
      });
      if (!resposta.ok) return null;

      const corpo = (await resposta.json()) as { usuarios: UsuariosDoPeriodo | null };
      return corpo.usuarios;
    } catch {
      return null;
    }
  },
};
