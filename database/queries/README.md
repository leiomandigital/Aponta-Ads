# Consultas de referência

Consultas SQL usadas como referência ao implementar `dashboardService.ts` e a
view `vw_lead_cost_daily` — não são executadas automaticamente, servem para
documentar e validar manualmente no Supabase Studio.

## CPM / CTR / CPC agregados (qualquer escopo)

CPM, CTR e CPC nunca são gravados como coluna — são razões, calculadas sempre
a partir da soma de `impressions`, `clicks` e `cost` no escopo exibido (dia,
campanha, período, ou a aba "Geral" combinando plataformas):

```sql
select
  sum(cost) / nullif(sum(impressions), 0) * 1000 as cpm,
  sum(clicks) / nullif(sum(impressions), 0) as ctr,
  sum(cost) / nullif(sum(clicks), 0) as cpc
from ad_performance_daily
where date between :inicio and :fim
  and (:platform is null or platform = :platform)
  and (:region is null or region = :region);
```

## Custo por lead por origem

```sql
select * from vw_lead_cost_daily
where date between :inicio and :fim
order by date desc;
```
