-- Mesma razão da migration 027: sync_logs.integration_key sozinho não diz mais
-- de qual CONTA é aquele log, já que uma key pode ter várias linhas de
-- integrations agora. Passa a gravar integration_id; integration_key continua
-- existindo só como texto solto (sem FK), útil pra exibir/filtrar por
-- plataforma sem precisar de join.
--
-- A FK antiga (sync_logs_integration_key_fkey, criada pela migration 006)
-- também precisa cair aqui: é ela que impede a migration 029 de trocar o
-- unique(key) de integrations por índices parciais.
alter table sync_logs
  add column integration_id uuid references integrations(id) on delete set null;

update sync_logs sl
  set integration_id = i.id
  from integrations i
  where i.key = sl.integration_key;

alter table sync_logs
  drop constraint sync_logs_integration_key_fkey;

create index idx_sync_logs_integration_id on sync_logs(integration_id);
