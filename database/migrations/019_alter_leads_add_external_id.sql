-- external_id é o identificador do lead na plataforma de origem (RD Station:
-- uuid da conversão). Sem isso, cada ciclo do cron que reprocessa um dia
-- dentro da janela de busca gravaria o mesmo lead de novo, inflando
-- leads_count em vw_lead_cost_daily — este índice torna o upsert idempotente.
alter table leads add column external_id text;

-- Sem WHERE: no Postgres, NULL nunca colide com NULL num índice único, então
-- leads sem external_id (fluxos futuros que não sejam RD Station) continuam
-- livres para ter múltiplas linhas.
create unique index ux_leads_source_external_id on leads(source, external_id);
