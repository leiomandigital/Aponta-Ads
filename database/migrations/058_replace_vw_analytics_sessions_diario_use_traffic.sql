-- Passa vw_analytics_sessions_diario a ler sessões e usuários de analytics_traffic_daily (sem página, fecha com o GA4)
-- e deixa só os leads vindo de analytics_sessions_daily (contagem de eventos, que soma certo por página).
--
-- RODAR SÓ DEPOIS do backfill de analytics_traffic_daily (database/manual/057_backfill_ga4_trafego.sql): a partir daqui,
-- um dia que não esteja na tabela nova aparece com 0 sessões no dashboard.
--
-- As colunas e os tipos da view são os mesmos de antes (date, device, account_id, sessions, users, leads), então o
-- dashboard e o PDF não precisam mudar de consulta. union all + group by (em vez de join) porque device/account_id
-- podem ser nulos e o group by já trata null = null.
create or replace view vw_analytics_sessions_diario as
select
  date,
  device,
  account_id,
  sum(sessions)::bigint as sessions,
  sum(users)::bigint as users,
  sum(leads)::bigint as leads
from (
  select date, device, account_id, sessions, users, 0 as leads
  from analytics_traffic_daily
  union all
  select date, device, account_id, 0 as sessions, 0 as users, leads
  from analytics_sessions_daily
) as origem
group by date, device, account_id;

grant select on vw_analytics_sessions_diario to authenticated;
