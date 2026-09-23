-- Linha única (single-tenant). Guarda a logo/marca do cliente para uso no
-- PDF exportado. Ver migration 017, que insere a linha inicial.
create table dashboard_settings (
  id uuid primary key default gen_random_uuid(),
  client_logo_url text,
  brand_primary_color text,
  updated_at timestamptz not null default now()
);

alter table dashboard_settings enable row level security;

create policy "authenticated_full_access"
  on dashboard_settings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
