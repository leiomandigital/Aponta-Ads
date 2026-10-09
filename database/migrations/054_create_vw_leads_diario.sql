-- Leads por dia, origem e conta, contados direto da tabela leads.
--
-- vw_lead_cost_daily (016/032) junta cada lead com as linhas de ad_performance_daily do mesmo dia/plataforma/conta
-- e faz count(*): um lead de google_ads (ou meta_ads) é repetido uma vez por linha de mídia do dia
-- (campanha x conjunto x anúncio), então leads_count saía maior que o real (ex.: 144 no card contra 110 leads
-- de verdade). Esta view não junta nada: uma linha de leads = um lead.
--
-- O dia é o de São Paulo (America/Sao_Paulo), não o dia UTC de captured_at::date — um lead das 22h de Brasília
-- caía no dia seguinte. Não altera nenhum dado nem tabela.
create or replace view vw_leads_diario as
select
  (captured_at at time zone 'America/Sao_Paulo')::date as date,
  source,
  account_id,
  count(*)::bigint as leads_count
from leads
where captured_at is not null
group by 1, 2, 3;

grant select on vw_leads_diario to authenticated;
