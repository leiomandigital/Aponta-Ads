-- Custos adicionais passam a ser lançados só com valor e descrição: o valor é
-- dividido 50% Google Ads / 50% Meta Ads automaticamente na leitura (ver
-- dashboardService.obterLancamentosDeCusto). O lançamento fica numa linha só,
-- com platform = 'todas' — assim o histórico mostra um lançamento por vez e
-- editar/excluir mexe nos dois lados de uma vez.
-- Lançamentos antigos (platform google_ads/meta_ads, com ou sem campanha) continuam valendo como estão.
alter table campaign_cost_entries drop constraint if exists campaign_cost_entries_platform_check;
alter table campaign_cost_entries
  add constraint campaign_cost_entries_platform_check check (platform in ('google_ads', 'meta_ads', 'todas'));
