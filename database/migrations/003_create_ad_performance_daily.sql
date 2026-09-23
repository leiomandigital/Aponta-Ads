-- Valores base e aditivos apenas. CPM/CTR/CPC nunca são gravados aqui — são
-- razões, calculadas sempre no momento da consulta a partir da soma de
-- impressions/clicks/cost no escopo exibido (ver dashboardService.ts).
create table ad_performance_daily (
  id uuid primary key default gen_random_uuid(),
  platform text not null, -- 'google_ads' | 'meta_ads'
  campaign_id text not null,
  campaign_name text,
  date date not null,
  impressions int not null default 0,
  clicks int not null default 0,
  cost numeric not null default 0,
  conversions int not null default 0,
  created_at timestamptz not null default now()
);

create unique index ux_ad_performance_daily_grain
  on ad_performance_daily (platform, campaign_id, date);

create index idx_ad_performance_daily_date on ad_performance_daily(date);
create index idx_ad_performance_daily_platform on ad_performance_daily(platform);

alter table ad_performance_daily enable row level security;

create policy "authenticated_full_access"
  on ad_performance_daily for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
