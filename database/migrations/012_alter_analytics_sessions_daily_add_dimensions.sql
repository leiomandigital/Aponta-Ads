-- O GA4 Data API permite combinar essas dimensões numa mesma consulta com
-- mais liberdade que Meta/Google Ads — não é necessário fatiar em tabelas
-- separadas aqui.
alter table analytics_sessions_daily
  add column page_path text,
  add column device text,
  add column age_range text,
  add column gender text,
  add column traffic_type text; -- 'cpc' | 'organic' | outros valores do GA4

drop index if exists ux_analytics_sessions_daily_grain;

create unique index ux_analytics_sessions_daily_grain
  on analytics_sessions_daily (
    date,
    coalesce(page_path, ''),
    coalesce(device, ''),
    coalesce(age_range, ''),
    coalesce(gender, ''),
    coalesce(traffic_type, '')
  );
