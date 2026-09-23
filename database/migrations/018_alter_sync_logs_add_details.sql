-- Uma integração pode gravar em várias tabelas de fato numa única
-- sincronização (ex: Google Ads → performance + conversões + palavras-chave).
-- details guarda o resultado de cada sub-busca dessa execução, ex:
-- {"ad_performance_daily": "success", "ad_conversions_daily": "error: token expirado"}
alter table sync_logs add column details jsonb;
