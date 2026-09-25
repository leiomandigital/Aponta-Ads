-- Sem isso, não existe nenhum jeito de verificar depois qual janela de datas
-- uma sincronização de fato usou (a Fase 2 unificou tudo em "sempre os
-- últimos 30 dias", mas sem registrar isso em algum lugar não dá pra
-- confirmar que está acontecendo de verdade dia após dia).
alter table sync_logs
  add column since_date date,
  add column until_date date;
