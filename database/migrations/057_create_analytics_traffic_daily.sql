-- Sessões e usuários do GA4 por dia x dispositivo x conta, SEM a página no grão.
--
-- Por que existe: analytics_sessions_daily guarda uma linha por dia x PÁGINA x dispositivo x canal. No GA4, a métrica
-- "sessions" pedida junto com a página conta a mesma visita uma vez para cada página que ela abriu — somar essas linhas
-- dá mais sessões do que o GA4 mostra (uma visita de 3 páginas virava 3 sessões). Sem a página, cada visita cai numa
-- linha só e a soma por dia fecha com o GA4.
--
-- users aqui é o "usuários do dia" (a mesma pessoa em dias diferentes aparece em cada dia). Não é somável para o período:
-- o total de usuários únicos do período vem direto do GA4 (api/analytics/usuarios.ts).
--
-- analytics_sessions_daily continua existindo (leads, top páginas). Esta migration não altera nenhum dado nem tabela
-- existente e não muda o dashboard — a view que ele lê só passa a usar esta tabela na migration 058, depois do backfill.
create table analytics_traffic_daily (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  date date not null,
  device text,
  sessions int not null default 0,
  users int not null default 0,
  created_at timestamptz not null default now()
);

-- nulls not distinct: o upsert do supabase-js só reconhece conflito se null = null (mesma razão da migration 022/031).
create unique index ux_analytics_traffic_daily_grain
  on analytics_traffic_daily (date, device, account_id) nulls not distinct;

create index idx_analytics_traffic_daily_date on analytics_traffic_daily(date);
create index idx_analytics_traffic_daily_account on analytics_traffic_daily(account_id);

alter table analytics_traffic_daily enable row level security;

create policy "authenticated_full_access"
  on analytics_traffic_daily for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
