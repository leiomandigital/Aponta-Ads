-- Detalhamento dos leads do GA4 (evento generate_lead) por dimensão da jornada:
-- caminho (página de entrada -> página do cadastro), origem/mídia, idade,
-- gênero, localização, novo x recorrente e dias entre a 1ª visita e o lead.
--
-- Formato "longo" (kind + dim1 + dim2) em vez de uma tabela por dimensão: cada
-- consulta ao GA4 Data API traz combinações diferentes de dimensões, e o
-- dashboard só soma leads por rótulo — não precisa cruzar uma dimensão com
-- outra. Contagem de eventos é aditiva, então somar as linhas dá o total.
--
--   kind            dim1                    dim2
--   'caminho'       landingPage             pagePath (onde o lead ocorreu)
--   'origem'        sessionSource           sessionMedium
--   'idade'         userAgeBracket          -
--   'genero'        userGender              -
--   'local'         region                  city
--   'retorno'       newVsReturning          -
--   'tempo'         dias entre a 1ª visita e o lead (inteiro, como texto)   -
--
-- Não existe "sessões até converter": o GA4 Data API não expõe o número da
-- sessão (só o export para BigQuery expõe).
create table analytics_lead_breakdown_daily (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  date date not null,
  kind text not null,
  dim1 text,
  dim2 text,
  leads int not null default 0,
  created_at timestamptz not null default now(),
  constraint analytics_lead_breakdown_daily_kind_check
    check (kind in ('caminho', 'origem', 'idade', 'genero', 'local', 'retorno', 'tempo'))
);

-- nulls not distinct: o upsert do supabase-js só reconhece conflito se null = null
-- (mesma razão da migration 022/031).
create unique index ux_analytics_lead_breakdown_daily_grain
  on analytics_lead_breakdown_daily (date, kind, dim1, dim2, account_id) nulls not distinct;

create index idx_analytics_lead_breakdown_daily_date on analytics_lead_breakdown_daily(date);
create index idx_analytics_lead_breakdown_daily_account on analytics_lead_breakdown_daily(account_id);

alter table analytics_lead_breakdown_daily enable row level security;

create policy "authenticated_full_access"
  on analytics_lead_breakdown_daily for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
