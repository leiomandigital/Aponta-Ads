-- Lançamentos manuais de custo, complementares ao spend automático gravado em
-- ad_performance_daily.cost: taxas cobradas pela plataforma no aporte de
-- saldo (não vêm em nenhum endpoint de insights) e custos avulsos externos
-- ligados a uma campanha (ex: sessão de fotos do produto anunciado).
--
-- campaign_id nulo = lançamento geral daquela plataforma/conta no período —
-- entra na soma dos cards do dashboard, mas não aparece quebrado em nenhuma
-- linha de campanha específica (não há como saber a qual campanha pertence).
create table campaign_cost_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  platform text not null, -- 'google_ads' | 'meta_ads'
  campaign_id text,
  category text not null, -- 'taxa_plataforma' | 'avulso'
  amount numeric not null,
  date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_cost_entries_platform_check check (platform in ('google_ads', 'meta_ads')),
  constraint campaign_cost_entries_category_check check (category in ('taxa_plataforma', 'avulso')),
  constraint campaign_cost_entries_amount_check check (amount > 0)
);

create index idx_campaign_cost_entries_date on campaign_cost_entries(date);
create index idx_campaign_cost_entries_platform_campaign on campaign_cost_entries(platform, campaign_id);
create index idx_campaign_cost_entries_account on campaign_cost_entries(account_id);

alter table campaign_cost_entries enable row level security;

create policy "authenticated_full_access"
  on campaign_cost_entries for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
