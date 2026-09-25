-- vw_lead_cost_daily (016) não filtrava por nada — o seletor de conta do
-- dashboard (etapa 8) precisa de account_id na view pra poder filtrar o
-- painel de custo por lead por conta. Resto da lógica original preservado
-- sem alteração (inclusive o join por date+platform, sem tocar em nenhuma
-- regra de negócio existente — isso não faz parte desta fase).
--
-- account_id vai no FINAL da lista de colunas de propósito: CREATE OR REPLACE
-- VIEW do Postgres não permite mudar nome/posição de coluna já existente, só
-- acrescentar no fim — colocar no meio (ex: logo depois de source) quebraria
-- a migration com "cannot change name of view column".
--
-- Join por account_id usa OR com IS NULL dos dois lados: uma linha de leads
-- ou de ad_performance_daily gravada por uma integração COMPARTILHADA tem
-- account_id nulo e deve casar com qualquer conta — mesma regra do filtro
-- "OR account_id IS NULL" usado no dashboardService (etapa 8).
create or replace view vw_lead_cost_daily as
select
  l.captured_at::date as date,
  l.source,
  count(*) as leads_count,
  coalesce(sum(a.cost), 0) as total_cost,
  case
    when count(*) > 0 then coalesce(sum(a.cost), 0) / count(*)
    else null
  end as cost_per_lead,
  l.account_id
from leads l
left join ad_performance_daily a
  on a.date = l.captured_at::date
  and a.platform = l.source
  and (a.account_id = l.account_id or a.account_id is null or l.account_id is null)
where l.captured_at is not null
group by l.captured_at::date, l.source, l.account_id;

grant select on vw_lead_cost_daily to authenticated;
