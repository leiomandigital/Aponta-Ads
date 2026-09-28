-- system_name e client_logo_url precisam aparecer mesmo pra quem ainda não
-- logou (aba do navegador, tela de login, nome do app instalado no celular)
-- — igual ao bucket brand-assets, que já é de leitura pública (ver migration
-- 020). Escrita continua exigindo sessão autenticada via
-- "authenticated_full_access" (migration 014).
create policy "leitura_publica_dashboard_settings"
  on dashboard_settings for select
  using (true);
