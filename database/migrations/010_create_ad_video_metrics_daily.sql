create table ad_video_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'meta_ads',
  campaign_id text not null,
  ad_id text,
  date date not null,
  plays_3s int default 0,
  thruplay int default 0, -- "play de 15 segundos" / ThruPlay
  video_p25 int default 0,
  video_p50 int default 0,
  video_p75 int default 0,
  video_p100 int default 0,
  region text,
  created_at timestamptz not null default now()
);

create unique index ux_ad_video_metrics_daily_grain
  on ad_video_metrics_daily (platform, campaign_id, coalesce(ad_id, ''), date);

create index idx_ad_video_metrics_daily_date on ad_video_metrics_daily(date);

alter table ad_video_metrics_daily enable row level security;

create policy "authenticated_full_access"
  on ad_video_metrics_daily for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
