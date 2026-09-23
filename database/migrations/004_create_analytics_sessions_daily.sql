create table analytics_sessions_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  sessions int not null default 0,
  users int not null default 0,
  conversions int not null default 0,
  created_at timestamptz not null default now()
);

create unique index ux_analytics_sessions_daily_grain
  on analytics_sessions_daily (date);

create index idx_analytics_sessions_daily_date on analytics_sessions_daily(date);

alter table analytics_sessions_daily enable row level security;

create policy "authenticated_full_access"
  on analytics_sessions_daily for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
