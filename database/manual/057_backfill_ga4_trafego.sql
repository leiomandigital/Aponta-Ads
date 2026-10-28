-- ============================================================================
-- ROTEIRO — Sessões e usuários do GA4 batendo com o Google Analytics (migrations 057 e 058)
--
-- Por que: o painel somava as sessões página por página, então uma visita que abriu 3 páginas virava 3 sessões.
-- Agora as sessões vêm de uma tabela nova (por dia e dispositivo, sem página) e os usuários do período vêm direto do GA4.
--
-- Faça as etapas NA ORDEM. Cada etapa diz ONDE fazer, O QUE fazer e O QUE ESPERAR.
-- Se o resultado não for o esperado, PARE e avise — não siga para a etapa seguinte.
-- Nada aqui apaga dado: a tabela antiga continua intacta e o sync só grava o que é novo.
-- ============================================================================


-- ============================================================================
-- ETAPA 1 — Criar a tabela nova (migration 057)
-- ONDE:     Supabase > SQL Editor
-- O QUE:    abra o arquivo database/migrations/057_create_analytics_traffic_daily.sql,
--           copie TODO o conteúdo e rode
-- ESPERAR:  "Success. No rows returned"
-- IMPORTANTE: esta etapa vem ANTES de subir o código (etapa 2). Se o código novo rodar sem ela,
--           o sync avança sem gravar o dado novo (fica um buraco no histórico).
-- ============================================================================


-- ============================================================================
-- ETAPA 2 — Subir o código novo para a Vercel
-- ONDE:     seu computador + site da Vercel (upload)
-- O QUE:    1) no terminal do projeto, rode:  npm run build:api
--           2) suba a pasta  src  do projeto (substituindo)
--           3) suba os 6 arquivos .js de  api-bundled/api/...  para  api/...  (substituindo) —
--              atenção: api/analytics/usuarios.js é NOVO, precisa existir na Vercel
--           4) faça o deploy normalmente e espere terminar com sucesso
-- ESPERAR:  deploy concluído, dashboard abrindo normalmente. Nesta etapa só os "Usuários" já passam a vir do GA4;
--           as sessões ainda aparecem como antes (a tabela nova está vazia).
-- ============================================================================


-- ============================================================================
-- ETAPA 3 — Anotar o estado da integração do GA4
-- ONDE:     Supabase > SQL Editor
-- O QUE:    rode o bloco abaixo e GUARDE o resultado (tire um print ou copie o valor de last_synced_at)
-- ESPERAR:  uma linha por conexão do GA4, com last_synced_at preenchido e backfill_cursor vazio
-- ============================================================================
    select id, key, status, last_synced_at, backfill_cursor from integrations where key = 'ga4';


-- ============================================================================
-- ETAPA 4 — Pedir a sincronização completa (180 dias) do GA4
-- ONDE:     Supabase > SQL Editor
-- O QUE:    rode o bloco abaixo
-- ESPERAR:  "Success", com o mesmo número de linhas afetadas que a etapa 3 devolveu
-- ============================================================================
update integrations set last_synced_at = null, backfill_cursor = null where key = 'ga4';


-- ============================================================================
-- ETAPA 5 — Rodar a sincronização
-- ONDE:     no próprio sistema (não é SQL): Configurações > integração do GA4 > botão de sincronizar
-- O QUE:    clique UMA vez e deixe a aba aberta. O sistema faz sozinho as etapas de 30 dias.
--           Se o GA4 tiver mais de uma conexão (uma por conta), repita para cada uma.
-- ESPERAR:  o botão voltar ao normal, e no histórico de sincronização aparecerem as linhas novas
--           (de hoje até ~180 dias atrás), todas "Sucesso". Se alguma terminar em erro ou "parcial", PARE e avise.
-- ============================================================================


-- ============================================================================
-- ETAPA 6 — Conferir
-- ONDE:     Supabase > SQL Editor
-- O QUE:    rode o bloco abaixo (troque as datas pelo período que você comparou no Google Analytics)
-- ESPERAR:  duas linhas. "tabela_nova" deve ficar bem MENOR que "tabela_antiga" e bater com o total de sessões
--           do Google Analytics no mesmo período (diferença de 1% a 2% é normal). min(date) da tabela nova
--           deve chegar a cerca de 180 dias atrás.
-- ============================================================================
select 'tabela_nova' as origem, sum(sessions) as sessoes, min(date), max(date)
from analytics_traffic_daily where date between '2026-10-18' and '2026-10-24'
union all
select 'tabela_antiga', sum(sessions), min(date), max(date)
from analytics_sessions_daily where date between '2026-10-18' and '2026-10-24';

select min(date) as primeiro_dia, max(date) as ultimo_dia, count(*) as linhas from analytics_traffic_daily;


-- ============================================================================
-- ETAPA 7 — Trocar a view que o dashboard lê (migration 058)
-- ONDE:     Supabase > SQL Editor
-- O QUE:    abra o arquivo database/migrations/058_replace_vw_analytics_sessions_diario_use_traffic.sql,
--           copie TODO o conteúdo e rode
-- ESPERAR:  "Success. No rows returned". Recarregue o dashboard: em "Sessões por dispositivo" e no card
--           "Sessões", os números passam a bater com o Google Analytics para o mesmo período.
-- SÓ FAÇA DEPOIS DA ETAPA 6: a partir daqui, dia que não esteja na tabela nova aparece com 0 sessões.
-- ============================================================================


-- ============================================================================
-- COMO DESFAZER (só se algo der errado — rode apenas o que precisar)
-- ============================================================================
-- Voltar o dashboard para a view antiga (desfaz a etapa 7; nenhum dado é perdido):
--   create or replace view vw_analytics_sessions_diario as
--   select date, device, account_id,
--     sum(sessions)::bigint as sessions, sum(users)::bigint as users, sum(leads)::bigint as leads
--   from analytics_sessions_daily
--   group by date, device, account_id;
--   grant select on vw_analytics_sessions_diario to authenticated;
--
-- Voltar a data de sincronização que você anotou na etapa 3 (desfaz a etapa 4):
--   update integrations set last_synced_at = '<valor anotado na etapa 3>', backfill_cursor = null where key = 'ga4';
--
-- Remover a tabela nova (só depois de voltar a view antiga):
--   drop table analytics_traffic_daily;
