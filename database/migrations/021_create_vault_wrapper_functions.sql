-- O schema `vault` não é exposto na Data API do Supabase (erro PGRST106:
-- "Invalid schema: vault"), então o supabase-js não consegue chamar o Vault
-- diretamente. Estas funções ficam em `public`, rodam como o dono (postgres,
-- via security definer) e só o `service_role` pode executá-las — assim o
-- segredo decriptado nunca fica acessível ao client (anon/authenticated).
-- Idempotente: pode ser executada mais de uma vez.

create or replace function public.criar_segredo_integracao(p_segredo text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return vault.create_secret(p_segredo, p_nome);
end;
$$;

create or replace function public.atualizar_segredo_integracao(p_id uuid, p_segredo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform vault.update_secret(p_id, p_segredo);
end;
$$;

create or replace function public.ler_segredo_integracao(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_segredo text;
begin
  select decrypted_secret into v_segredo from vault.decrypted_secrets where id = p_id;
  return v_segredo;
end;
$$;

-- Funções nascem executáveis por `public` (todos os roles); revogar antes de
-- conceder só ao service_role.
revoke all on function public.criar_segredo_integracao(text, text) from public, anon, authenticated;
revoke all on function public.atualizar_segredo_integracao(uuid, text) from public, anon, authenticated;
revoke all on function public.ler_segredo_integracao(uuid) from public, anon, authenticated;

grant execute on function public.criar_segredo_integracao(text, text) to service_role;
grant execute on function public.atualizar_segredo_integracao(uuid, text) to service_role;
grant execute on function public.ler_segredo_integracao(uuid) to service_role;
