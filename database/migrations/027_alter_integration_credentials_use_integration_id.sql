-- integration_credentials guardava 1 linha por integration_key (texto), porque
-- só existia 1 conta possível por plataforma. Agora que integrations pode ter
-- várias linhas com a mesma key (uma por conta, mais a compartilhada), a
-- credencial precisa apontar pra linha específica (integration_id), não mais
-- pra chave da plataforma.
alter table integration_credentials
  add column integration_id uuid references integrations(id) on delete cascade;

update integration_credentials ic
  set integration_id = i.id
  from integrations i
  where i.key = ic.integration_key;

alter table integration_credentials
  alter column integration_id set not null;

alter table integration_credentials
  add constraint integration_credentials_integration_id_key unique (integration_id);

-- Derruba junto a FK antiga integration_credentials_integration_key_fkey e o
-- unique(integration_key) da migration 002 — nenhum dos dois faz sentido
-- depois que a credencial passa a ser 1:1 com a LINHA da integração, não com
-- a plataforma.
alter table integration_credentials
  drop column integration_key;
