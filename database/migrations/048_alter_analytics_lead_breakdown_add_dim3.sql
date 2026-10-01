-- Caminho do lead passa a ter 3 passos: página de entrada (dim1) -> página
-- anterior ao cadastro (dim3, pageReferrer do GA4) -> página do cadastro (dim2).
-- dim3 entra no grão da tabela; só 'caminho' usa.
--
-- As linhas 'caminho' já gravadas não têm dim3 e, se ficassem, somariam em
-- dobro com as novas após o próximo sync (mesma data, mesmos leads, chave
-- diferente). Por isso são apagadas aqui — o sync do GA4 regrava o período.
alter table analytics_lead_breakdown_daily add column dim3 text;

delete from analytics_lead_breakdown_daily where kind = 'caminho';

drop index ux_analytics_lead_breakdown_daily_grain;

create unique index ux_analytics_lead_breakdown_daily_grain
  on analytics_lead_breakdown_daily (date, kind, dim1, dim2, dim3, account_id) nulls not distinct;
