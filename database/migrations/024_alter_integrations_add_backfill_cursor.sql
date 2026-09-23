-- Marca até onde o backfill de 180 dias já avançou, quando ele precisa ser
-- feito em várias etapas (60 dias por vez) para caber no limite de tempo de
-- execução da função na Vercel. null = nenhum backfill em andamento (ainda
-- não começou, ou já terminou e last_synced_at assumiu o controle normal).
-- Idempotente.
alter table integrations
  add column if not exists backfill_cursor date;
