-- Guarda quais propriedades/páginas de uma integração o usuário escolheu
-- importar (GA4: 1 propriedade por integração; RD Station: vários
-- identificadores). Sem linha nenhuma aqui = nada foi selecionado ainda =
-- conector não deve trazer dado (evita importar tudo indiscriminadamente
-- assim que a credencial é salva).
create table integration_selected_assets (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(id) on delete cascade,
  external_id text not null,
  name text,
  created_at timestamptz not null default now(),
  unique(integration_id, external_id)
);

alter table integration_selected_assets enable row level security;

create policy "authenticated_full_access"
  on integration_selected_assets for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
