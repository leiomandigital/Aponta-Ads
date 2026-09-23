-- Específica do Google Ads. Não traz palavras-chave negativas (descartado na
-- reunião de kickoff).
create table ad_keyword_performance_daily (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  campaign_name text,
  date date not null,
  keyword text not null,
  search_term text,
  clicks int default 0,
  impressions int default 0,
  cost numeric default 0,
  cpc numeric,
  region text,
  created_at timestamptz not null default now()
);

create unique index ux_ad_keyword_performance_daily_grain
  on ad_keyword_performance_daily (campaign_id, keyword, coalesce(search_term, ''), date);

create index idx_ad_keyword_performance_daily_date on ad_keyword_performance_daily(date);
create index idx_ad_keyword_performance_daily_campaign on ad_keyword_performance_daily(campaign_id);

alter table ad_keyword_performance_daily enable row level security;

create policy "authenticated_full_access"
  on ad_keyword_performance_daily for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
