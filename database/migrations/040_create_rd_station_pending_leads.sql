-- Toda conversão que chega via webhook de um identificador AINDA NÃO
-- selecionado fica retida aqui — não só a mais recente (isso substitui a
-- abordagem de integration_discovered_assets.last_payload, que só guardava 1
-- ocorrência). Quando o identificador é selecionado, save-assets.ts grava
-- todas as linhas pendentes dele em `leads` de uma vez e limpa esta tabela.
-- Identificadores JÁ selecionados não passam por aqui — vão direto pra
-- `leads` no próprio webhook.
create table rd_station_pending_leads (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(id) on delete cascade,
  external_id text not null, -- event_identifier
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index idx_rd_station_pending_leads_lookup on rd_station_pending_leads(integration_id, external_id);

alter table rd_station_pending_leads enable row level security;

create policy "authenticated_full_access"
  on rd_station_pending_leads for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
