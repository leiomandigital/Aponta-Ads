-- Idade e gênero frequentemente não vêm combinados com evento de conversão
-- na mesma chamada de API (limitação conhecida do Meta Ads) — tabela própria.
create table ad_performance_demographics_daily (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  campaign_id text not null,
  date date not null,
  age_range text,
  gender text,
  impressions int default 0,
  clicks int default 0,
  cost numeric default 0,
  region text,
  created_at timestamptz not null default now()
);

create unique index ux_ad_performance_demographics_daily_grain
  on ad_performance_demographics_daily (platform, campaign_id, coalesce(age_range, ''), coalesce(gender, ''), date);

create index idx_ad_performance_demographics_daily_date on ad_performance_demographics_daily(date);

alter table ad_performance_demographics_daily enable row level security;

create policy "authenticated_full_access"
  on ad_performance_demographics_daily for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
