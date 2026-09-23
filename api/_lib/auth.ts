import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function extrairTokenBearer(req: VercelRequest): string | null {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith('Bearer ')) return null;
  return cabecalho.slice('Bearer '.length);
}

/** true só se o token bater exatamente com CRON_SECRET — usado por /api/sync/dispatch. */
export function autenticarCron(req: VercelRequest): boolean {
  const token = extrairTokenBearer(req);
  return !!token && !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
}

/**
 * Valida o JWT do usuário contra o Supabase Auth. Usado por
 * /api/integrations/save-credentials, /api/export/pdf e pela chamada manual
 * de /api/sync/dispatch. Retorna o id do usuário autenticado ou null.
 */
export async function autenticarUsuario(req: VercelRequest): Promise<string | null> {
  const token = extrairTokenBearer(req);
  if (!token) return null;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const supabase = createClient(supabaseUrl, anonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user.id;
}
