-- Identificadores de conversão (event_identifier) já vistos em eventos reais
-- do webhook do RD Station — a API do RD Station Marketing não tem um
-- endpoint pra LISTAR conversões/formulários por período (só recebe em tempo
-- real via webhook), então não dá mais pra popular a tela de seleção de
-- ativos amostrando a API antes de existir conversão de verdade. Toda
-- conversão recebida grava aqui, independente de estar selecionada ou não em
-- integration_selected_assets — só assim a lista de "disponíveis" cresce
-- conforme o uso real, em vez de ficar vazia para sempre.
create table integration_discovered_assets (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(id) on delete cascade,
  external_id text not null,
  name text,
  first_seen_at timestamptz not null default now(),
  unique(integration_id, external_id)
);

alter table integration_discovered_assets enable row level security;

create policy "authenticated_full_access"
  on integration_discovered_assets for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
