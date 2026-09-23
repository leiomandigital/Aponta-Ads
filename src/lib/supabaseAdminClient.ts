import { createClient } from '@supabase/supabase-js';

/**
 * Client server-only, autenticado com a service_role key. Único jeito de ler
 * vault.decrypted_secrets (Supabase Vault) e de gravar sync_logs/tabelas de
 * fato durante a sincronização. Nunca importar este arquivo de um componente
 * ou hook que rode no navegador — só de /api/* e /src/integrations/*.
 */
export function criarSupabaseAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos no ambiente do servidor');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
