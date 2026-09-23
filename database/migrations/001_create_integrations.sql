-- Extensão necessária para gen_random_uuid() usado em todas as tabelas.
-- Supabase Vault (schema `vault`, extensão pgsodium) já vem habilitado por padrão
-- em todo projeto Supabase — nenhuma migration precisa criá-lo.
create extension if not exists pgcrypto;

create table integrations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- 'google_ads' | 'ga4' | 'meta_ads' | 'rd_station'
  name text not null,
  is_active boolean not null default false,
  status text not null default 'disconnected'
    check (status in ('connected', 'error', 'pending', 'disconnected')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table integrations enable row level security;

create policy "authenticated_full_access"
  on integrations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Single-tenant: as 4 plataformas já nascem cadastradas, desativadas até o
-- usuário conectar cada uma pela tela de Integrações.
insert into integrations (key, name) values
  ('google_ads', 'Google Ads'),
  ('ga4', 'Google Analytics 4'),
  ('meta_ads', 'Meta Ads'),
  ('rd_station', 'RD Station');
