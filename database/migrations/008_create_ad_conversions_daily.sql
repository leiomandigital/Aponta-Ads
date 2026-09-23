-- Tabela separada porque o Google Ads não entrega nome da conversão na mesma
-- consulta de cliques/impressões — obrigatório para Google Ads e Meta Ads.
create table ad_conversions_daily (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  campaign_id text not null,
  campaign_name text,
  adset_id text,
  adset_name text,
  date date not null,
  conversion_name text not null, -- ex: 'lead', 'venda', 'registro_concluido', 'visualizacao_pagina_destino'
  conversions int not null default 0,
  conversion_value numeric,
  region text,
  created_at timestamptz not null default now()
);

create unique index ux_ad_conversions_daily_grain
  on ad_conversions_daily (platform, campaign_id, coalesce(adset_id, ''), conversion_name, date);

create index idx_ad_conversions_daily_date on ad_conversions_daily(date);

alter table ad_conversions_daily enable row level security;

create policy "authenticated_full_access"
  on ad_conversions_daily for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
