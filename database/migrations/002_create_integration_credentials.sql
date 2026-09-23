-- encrypted_payload guarda apenas o uuid retornado por vault.create_secret(),
-- nunca o segredo em texto plano. Ver Integration Security Skill, seção 1.
create table integration_credentials (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null unique references integrations(key) on delete cascade,
  encrypted_payload uuid,
  updated_at timestamptz not null default now()
);

alter table integration_credentials enable row level security;

create policy "authenticated_full_access"
  on integration_credentials for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
