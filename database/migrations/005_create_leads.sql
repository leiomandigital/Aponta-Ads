-- created_at é metadado de INSERÇÃO na Supabase (default now()), não a data
-- real do lead. Nenhuma lógica de negócio deve ler created_at — ver 015, que
-- adiciona captured_at (a data real, vinda da API do RD Station).
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  source text, -- origem do lead, ex: 'google_ads' | 'meta_ads' — depende de UTM padronizado
  funnel_stage text,
  created_at timestamptz not null default now()
);

create index idx_leads_source on leads(source);

alter table leads enable row level security;

create policy "authenticated_full_access"
  on leads for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
