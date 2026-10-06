-- Sessões, usuários e leads do GA4 somados por dia, dispositivo e conta.
--
-- analytics_sessions_daily tem uma linha por dia x página x dispositivo x canal x ... — só 30 dias passam de
-- 4 mil linhas, e o dashboard (que lê no máximo 1000 por consulta) precisa só do total por dia e por dispositivo.
-- Esta view faz exatamente a soma que o dashboard já fazia no navegador, mantendo account_id para os filtros
-- de conta funcionarem igual. Não altera nenhum dado nem tabela.
--
-- sum() de int vira bigint, que o PostgREST devolve como número (não texto).
create or replace view vw_analytics_sessions_diario as
select
  date,
  device,
  account_id,
  sum(sessions)::bigint as sessions,
  sum(users)::bigint as users,
  sum(leads)::bigint as leads
from analytics_sessions_daily
group by date, device, account_id;

grant select on vw_analytics_sessions_diario to authenticated;
