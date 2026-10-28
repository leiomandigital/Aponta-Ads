-- Custos adicionais passam a ser lançados por plataforma (Google Ads ou Meta Ads), como valor em reais
-- ('valor') ou como percentual ('porcentagem'):
--   * 'valor'       -> amount é o valor em R$ somado ao custo da plataforma;
--   * 'porcentagem' -> amount é o percentual (10 = 10%), aplicado sobre o custo com taxas da plataforma
--                      (Google Ads: custo de mídia; Meta Ads: mídia + taxa automática de 12,15%).
-- Lançamentos antigos viram 'valor' (default) e continuam valendo exatamente como estavam.
alter table campaign_cost_entries add column kind text not null default 'valor';

alter table campaign_cost_entries
  add constraint campaign_cost_entries_kind_check check (kind in ('valor', 'porcentagem'));
