-- Leads do GA4: contagem diária do evento `generate_lead`, na mesma granularidade
-- de analytics_sessions_daily (data, página, dispositivo, canal). Substitui
-- `conversions` no painel de Analytics — a métrica `conversions` foi descontinuada
-- no GA4 e a propriedade não tem eventos-chave marcados, então ela vinha sempre 0.
-- A coluna `conversions` continua na tabela, sem uso.
-- Contagem de eventos é aditiva (cada evento tem uma única página/dispositivo/canal),
-- então somar as linhas dá o total correto. Idempotente.
alter table analytics_sessions_daily
  add column if not exists leads int not null default 0;
