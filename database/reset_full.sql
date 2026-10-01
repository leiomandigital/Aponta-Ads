-- LIMPEZA DE DADOS — esvazia todas as tabelas e mantém o schema intacto.
-- Não recria linhas-base: o app cria conta, integrações e dashboard_settings sozinho.
-- Irreversível. Rode no SQL Editor do Supabase.
--
-- Não toca em: auth.users, bucket/arquivos de storage (logo), funções e policies.

begin;

-- 1) Segredos do Vault referenciados pelas credenciais (antes de esvaziar a tabela)
delete from vault.secrets
where id in (
  select encrypted_payload from public.integration_credentials
  where encrypted_payload is not null
);

-- 2) Esvazia todas as tabelas (cascade resolve as FKs)
truncate table
  public.rd_station_pending_leads,
  public.integration_discovered_assets,
  public.integration_selected_assets,
  public.integration_credentials,
  public.sync_logs,
  public.campaign_cost_entries,
  public.analytics_lead_breakdown_daily,
  public.analytics_sessions_daily,
  public.ad_keyword_performance_daily,
  public.ad_video_metrics_daily,
  public.ad_performance_demographics_daily,
  public.ad_conversions_daily,
  public.ad_performance_daily,
  public.campaign_region_map,
  public.leads,
  public.dashboard_settings,
  public.integrations,
  public.accounts
restart identity cascade;

commit;
