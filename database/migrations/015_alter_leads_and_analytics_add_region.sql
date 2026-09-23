-- Bug evitado aqui: leads.created_at (migration 005) grava default now() —
-- a data de INSERÇÃO na Supabase, não a data em que o lead de fato
-- aconteceu no RD Station. Como o backfill e a vw_lead_cost_daily (016)
-- dependem de comparar a data do lead com a data do gasto da campanha, usar
-- created_at faria todo lead parecer "de hoje" — quebrando a métrica de
-- custo por lead por completo. captured_at é preenchido obrigatoriamente
-- pelo normalize.ts do conector RD Station com o timestamp que a própria
-- API devolve para o lead, nunca deixado no default. created_at continua
-- existindo só como metadado de gravação — nenhuma lógica de negócio deve
-- lê-lo.
alter table leads add column region text; -- 'ES' | 'TO'
alter table leads add column captured_at timestamptz;

create index idx_leads_captured_at on leads(captured_at);

alter table analytics_sessions_daily add column region text;
