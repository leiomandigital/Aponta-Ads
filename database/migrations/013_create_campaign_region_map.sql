-- Fonte da verdade para a região de cada campanha — editável na tela de
-- configurações. normalize.ts pode SUGERIR uma região a partir do nome da
-- campanha, mas a atribuição final vem sempre desta tabela.
create table campaign_region_map (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  campaign_id text not null,
  campaign_name text,
  region text not null check (region in ('ES', 'TO')),
  created_at timestamptz not null default now(),
  unique(platform, campaign_id)
);

alter table campaign_region_map enable row level security;

create policy "authenticated_full_access"
  on campaign_region_map for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
