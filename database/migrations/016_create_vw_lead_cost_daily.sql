-- Custo por lead por origem — a métrica central para comparar Facebook e
-- Google. Usa captured_at (015), nunca created_at — ver nota na 015.
-- Depende de leads.source estar preenchido corretamente via UTM padronizado.
create view vw_lead_cost_daily as
select
  l.captured_at::date as date,
  l.source,
  count(*) as leads_count,
  coalesce(sum(a.cost), 0) as total_cost,
  case
    when count(*) > 0 then coalesce(sum(a.cost), 0) / count(*)
    else null
  end as cost_per_lead
from leads l
left join ad_performance_daily a
  on a.date = l.captured_at::date
  and a.platform = l.source
where l.captured_at is not null
group by l.captured_at::date, l.source;

-- auth.role() é lido do JWT da requisição, não do dono da view — mas o
-- GRANT em si precisa ser explícito para a role authenticated.
grant select on vw_lead_cost_daily to authenticated;
