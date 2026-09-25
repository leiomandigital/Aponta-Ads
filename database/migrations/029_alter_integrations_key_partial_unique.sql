-- Agora que integration_credentials (027) e sync_logs (028) não têm mais FK
-- para integrations(key), dá pra trocar o unique(key) original (migration 001)
-- por dois índices únicos parciais, permitindo múltiplas linhas com a mesma
-- key — uma por conta, no máximo — mantendo a regra de negócio:
--   - no máximo 1 integração COMPARTILHADA por plataforma (account_id nulo);
--   - no máximo 1 integração PRÓPRIA por conta e por plataforma.
alter table integrations
  drop constraint integrations_key_key;

create unique index ux_integrations_key_shared
  on integrations(key)
  where account_id is null;

create unique index ux_integrations_account_key
  on integrations(account_id, key)
  where account_id is not null;
