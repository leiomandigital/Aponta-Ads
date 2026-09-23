-- As migrations 007 a 012 criaram índices únicos sobre expressões
-- (coalesce(coluna, '')). O supabase-js/PostgREST só aceita nomes de coluna em
-- `onConflict`, e o Postgres só usa como árbitro um índice único que contenha
-- exatamente as colunas informadas — um índice de expressão nunca casa, e todo
-- upsert falha com 42P10 ("there is no unique or exclusion constraint matching
-- the ON CONFLICT specification").
--
-- Solução: índice único sobre as colunas puras com NULLS NOT DISTINCT, que
-- mantém a semântica anterior (nulos contam como iguais) sem mudar código.
-- Requer Postgres >= 15 (confira com `select version();` antes de rodar).
-- Idempotente: pode ser executada mais de uma vez.

drop index if exists ux_ad_performance_daily_grain;
create unique index ux_ad_performance_daily_grain
  on ad_performance_daily (platform, campaign_id, adset_id, ad_id, date) nulls not distinct;

drop index if exists ux_ad_conversions_daily_grain;
create unique index ux_ad_conversions_daily_grain
  on ad_conversions_daily (platform, campaign_id, adset_id, conversion_name, date) nulls not distinct;

drop index if exists ux_ad_performance_demographics_daily_grain;
create unique index ux_ad_performance_demographics_daily_grain
  on ad_performance_demographics_daily (platform, campaign_id, age_range, gender, date) nulls not distinct;

drop index if exists ux_ad_video_metrics_daily_grain;
create unique index ux_ad_video_metrics_daily_grain
  on ad_video_metrics_daily (platform, campaign_id, ad_id, date) nulls not distinct;

drop index if exists ux_ad_keyword_performance_daily_grain;
create unique index ux_ad_keyword_performance_daily_grain
  on ad_keyword_performance_daily (campaign_id, keyword, search_term, date) nulls not distinct;

drop index if exists ux_analytics_sessions_daily_grain;
create unique index ux_analytics_sessions_daily_grain
  on analytics_sessions_daily (date, page_path, device, age_range, gender, traffic_type) nulls not distinct;
