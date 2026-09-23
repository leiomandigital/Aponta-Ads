-- Dados de exemplo para desenvolvimento local — nunca rodar em produção.
-- Ativa as 4 integrações (sem credencial real) e insere algumas linhas de
-- ad_performance_daily para o dashboard não ficar vazio durante o
-- desenvolvimento de telas.

update integrations set is_active = true, status = 'connected', last_synced_at = now();

insert into campaign_region_map (platform, campaign_id, campaign_name, region) values
  ('google_ads', 'seed-camp-es-1', 'Institucional ES', 'ES'),
  ('google_ads', 'seed-camp-to-1', 'Institucional TO', 'TO'),
  ('meta_ads', 'seed-camp-es-2', 'Conversão ES', 'ES'),
  ('meta_ads', 'seed-camp-to-2', 'Conversão TO', 'TO');

insert into ad_performance_daily (platform, campaign_id, campaign_name, date, impressions, clicks, cost, conversions, region) values
  ('google_ads', 'seed-camp-es-1', 'Institucional ES', current_date - 1, 12000, 340, 850.50, 18, 'ES'),
  ('google_ads', 'seed-camp-to-1', 'Institucional TO', current_date - 1, 8000, 210, 520.00, 9, 'TO'),
  ('meta_ads', 'seed-camp-es-2', 'Conversão ES', current_date - 1, 15000, 480, 610.75, 25, 'ES'),
  ('meta_ads', 'seed-camp-to-2', 'Conversão TO', current_date - 1, 9000, 260, 390.20, 14, 'TO');

insert into analytics_sessions_daily (date, sessions, users, conversions, device, traffic_type) values
  (current_date - 1, 2400, 1980, 40, 'mobile', 'cpc'),
  (current_date - 1, 1600, 1310, 22, 'desktop', 'organic');

insert into leads (name, email, source, funnel_stage, region, captured_at) values
  ('Lead de exemplo ES', 'lead.es@exemplo.com', 'google_ads', 'novo', 'ES', now() - interval '1 day'),
  ('Lead de exemplo TO', 'lead.to@exemplo.com', 'meta_ads', 'qualificado', 'TO', now() - interval '1 day');
