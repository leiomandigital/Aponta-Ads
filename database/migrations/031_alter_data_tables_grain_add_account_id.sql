-- Os índices únicos de grão recriados pela migration 022 (com NULLS NOT
-- DISTINCT, pro upsert do supabase-js funcionar) precisam incluir account_id
-- agora. Sem isso, dois problemas reais:
--
-- 1) Uma integração COMPARTILHADA grava account_id = null em toda linha. Sem
--    account_id no índice, o Postgres nunca detectaria conflito entre duas
--    sincronizações da mesma campanha/dia — cada ciclo de sync inseriria
--    linhas novas em vez de atualizar, duplicando custo/conversão a cada
--    execução.
-- 2) analytics_sessions_daily não tem campaign_id no grão — só
--    page_path/device/faixa etária/gênero/tipo de tráfego. Duas contas
--    diferentes de GA4 (duas propriedades) podem perfeitamente ter uma linha
--    de "/" + mobile no mesmo dia — sem account_id no índice, a segunda conta
--    sincronizada sobrescreveria as sessões da primeira.
--
-- leads fica de fora de propósito: ux_leads_source_external_id (migration 019)
-- usa o external_id da própria API do RD Station, que já é globalmente único
-- — não precisa de account_id no índice, só a coluna (030) serve pro filtro
-- do dashboard.
drop index if exists ux_ad_performance_daily_grain;
create unique index ux_ad_performance_daily_grain
  on ad_performance_daily (platform, campaign_id, adset_id, ad_id, date, account_id) nulls not distinct;

drop index if exists ux_ad_conversions_daily_grain;
create unique index ux_ad_conversions_daily_grain
  on ad_conversions_daily (platform, campaign_id, adset_id, conversion_name, date, account_id) nulls not distinct;

drop index if exists ux_ad_performance_demographics_daily_grain;
create unique index ux_ad_performance_demographics_daily_grain
  on ad_performance_demographics_daily (platform, campaign_id, age_range, gender, date, account_id) nulls not distinct;

drop index if exists ux_ad_video_metrics_daily_grain;
create unique index ux_ad_video_metrics_daily_grain
  on ad_video_metrics_daily (platform, campaign_id, ad_id, date, account_id) nulls not distinct;

drop index if exists ux_ad_keyword_performance_daily_grain;
create unique index ux_ad_keyword_performance_daily_grain
  on ad_keyword_performance_daily (campaign_id, keyword, search_term, date, account_id) nulls not distinct;

drop index if exists ux_analytics_sessions_daily_grain;
create unique index ux_analytics_sessions_daily_grain
  on analytics_sessions_daily (date, page_path, device, age_range, gender, traffic_type, account_id) nulls not distinct;
