-- account_id chega como coluna aditiva em toda tabela de dado sincronizado —
-- não mexe em region/campaign_region_map, que continuam servindo o
-- mecanismo antigo (uma conta de anúncio compartilhada entre ES/TO,
-- diferenciada por campanha). account_id é o mecanismo novo, para quando a
-- unidade tem sua PRÓPRIA conta de anúncio.
--
-- "on delete set null" em vez de cascade: se uma conta um dia for removida
-- (fora do escopo desta fase — não há UI para isso ainda), o histórico de
-- gasto/lead não desaparece, só perde a amarração com a conta.
--
-- Todo dado já existente pertence à mesma conta original — backfill pra
-- accounts.is_default em cada tabela.
alter table ad_performance_daily add column account_id uuid references accounts(id) on delete set null;
alter table ad_conversions_daily add column account_id uuid references accounts(id) on delete set null;
alter table ad_performance_demographics_daily add column account_id uuid references accounts(id) on delete set null;
alter table ad_video_metrics_daily add column account_id uuid references accounts(id) on delete set null;
alter table ad_keyword_performance_daily add column account_id uuid references accounts(id) on delete set null;
alter table leads add column account_id uuid references accounts(id) on delete set null;
alter table analytics_sessions_daily add column account_id uuid references accounts(id) on delete set null;

update ad_performance_daily set account_id = (select id from accounts where is_default limit 1) where account_id is null;
update ad_conversions_daily set account_id = (select id from accounts where is_default limit 1) where account_id is null;
update ad_performance_demographics_daily set account_id = (select id from accounts where is_default limit 1) where account_id is null;
update ad_video_metrics_daily set account_id = (select id from accounts where is_default limit 1) where account_id is null;
update ad_keyword_performance_daily set account_id = (select id from accounts where is_default limit 1) where account_id is null;
update leads set account_id = (select id from accounts where is_default limit 1) where account_id is null;
update analytics_sessions_daily set account_id = (select id from accounts where is_default limit 1) where account_id is null;
