-- Um clique em "sincronizar agora" durante o backfill de 180 dias dispara
-- várias etapas de 30 dias em sequência (ver sincronizarIntegracaoAteCompletar
-- em integrationsService.ts) — cada etapa já gravava sua própria linha em
-- sync_logs, mas sem nenhum jeito de saber que várias linhas vieram do MESMO
-- clique. run_id resolve isso: fica igual em todas as etapas de uma mesma
-- execução manual, pra tela de histórico poder agrupar por ele.
--
-- Nulo pra sincronização automática de propósito — o cron nunca dispara mais
-- de uma etapa por integração na mesma execução (avança 1 etapa por dia,
-- quando ainda está em backfill), então cada linha automática já é, sozinha,
-- o próprio "evento" — não precisa de agrupamento.
alter table sync_logs
  add column run_id uuid;

create index idx_sync_logs_run_id on sync_logs(run_id);
