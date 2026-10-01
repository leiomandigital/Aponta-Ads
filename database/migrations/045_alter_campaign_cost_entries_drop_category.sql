-- Taxa da plataforma deixou de ser lançada manualmente: passou a ser
-- calculada automaticamente (ver TAXA_PLATAFORMA_META em
-- metricsAggregation.ts) a partir do imposto fixo que a Meta passou a
-- repassar ao anunciante brasileiro desde 01/01/2026. Todo lançamento em
-- campaign_cost_entries agora é sempre um custo avulso — a coluna category
-- não faz mais sentido.
alter table campaign_cost_entries drop constraint if exists campaign_cost_entries_category_check;
alter table campaign_cost_entries drop column if exists category;
