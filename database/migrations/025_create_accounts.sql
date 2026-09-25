-- "Conta" representa uma unidade/cliente com sua própria conta de anúncio
-- (ex: uma cidade diferente por conta). Antes desta migration, o sistema era
-- rigidamente single-tenant: uma única integração global por plataforma.
-- A partir daqui, integrations.account_id (migration 026) amarra cada
-- integração a uma conta específica, ou a nenhuma (integração compartilhada).
create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Marca a conta original, criada por esta migration para não deixar as
  -- integrações e os dados já existentes órfãos. Nunca mais de uma linha com
  -- is_default = true — não há índice único aplicado porque não há UI para
  -- criar uma segunda conta padrão; só existe pra dar nome ao id de destino
  -- do backfill das próximas migrations.
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table accounts enable row level security;

create policy "authenticated_full_access"
  on accounts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into accounts (name, is_default) values ('Conta Principal', true);
