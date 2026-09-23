alter table ad_performance_daily
  add column adset_id text,
  add column adset_name text,
  add column ad_id text,
  add column ad_name text,
  add column region text; -- 'ES' | 'TO' — resolvido via campaign_region_map, não por string matching direto

-- A granularidade real passou a incluir adset/ad. adset_id/ad_id são
-- nullable (Performance Max não tem essa quebra) — coalesce evita que duas
-- linhas nulas colidam incorretamente com a unicidade antiga.
drop index if exists ux_ad_performance_daily_grain;

create unique index ux_ad_performance_daily_grain
  on ad_performance_daily (platform, campaign_id, coalesce(adset_id, ''), coalesce(ad_id, ''), date);
