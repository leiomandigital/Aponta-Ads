import { supabase } from '@/lib/supabaseClient';
import { criarDashboardQueries } from '@/services/dashboardQueries';

export type { FiltrosDashboard } from '@/services/dashboardQueries';

export const dashboardService = criarDashboardQueries(supabase);
