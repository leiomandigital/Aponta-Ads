-- Mudança de modelo: a seleção de identificadores numa integração
-- COMPARTILHADA passou a ser por conta, não um valor opcional por
-- identificador (ver migration 044). Cada conta que visualiza a integração
-- compartilhada marca sua PRÓPRIA seleção, independente das outras — por
-- isso o mesmo external_id pode ter uma linha por conta agora. O índice
-- único antigo (integration_id, external_id) impedia isso.
alter table integration_selected_assets
  drop constraint integration_selected_assets_integration_id_external_id_key;

alter table integration_selected_assets
  add constraint integration_selected_assets_integration_account_external_key
  unique (integration_id, account_id, external_id);
