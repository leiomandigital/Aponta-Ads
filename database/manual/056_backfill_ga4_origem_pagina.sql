-- ============================================================================
-- ROTEIRO — Origem/mídia filtrada pelos formulários das contas (GA4 + página do cadastro)
--
-- Faça as etapas NA ORDEM. Cada etapa diz ONDE fazer, O QUE fazer e O QUE ESPERAR.
-- Se o resultado não for o esperado, PARE e avise — não siga para a etapa seguinte.
-- Nada aqui apaga dado: o sync só grava o que é novo.
-- ============================================================================


-- ============================================================================
-- ETAPA 1 — Cópia de segurança
-- ONDE:     Supabase > SQL Editor
-- O QUE:    rode o bloco abaixo (as duas linhas juntas)
-- ESPERAR:  a 2ª linha devolve um número; esse número é o total de linhas da cópia
-- ============================================================================
create table analytics_lead_breakdown_daily_bkp as select * from analytics_lead_breakdown_daily;
select count(*) as linhas_na_copia from analytics_lead_breakdown_daily_bkp;


-- ============================================================================
-- ETAPA 2 — Atualizar a regra de tipos do banco (migration 056)
-- ONDE:     Supabase > SQL Editor
-- O QUE:    abra o arquivo database/migrations/056_alter_analytics_lead_breakdown_add_origem_pagina.sql,
--           copie TODO o conteúdo e rode
-- ESPERAR:  "Success. No rows returned"
-- IMPORTANTE: esta etapa vem ANTES de subir o código (etapa 3). Se o código novo rodar sem ela,
--           o banco recusa o dado novo e o sync avança sem gravá-lo (fica um buraco no histórico).
-- ============================================================================


-- ============================================================================
-- ETAPA 3 — Subir o código novo para a Vercel
-- ONDE:     seu computador + site da Vercel (upload)
-- O QUE:    1) no terminal do projeto, rode:  npm run build:api
--           2) copie a pasta  src  do projeto para a pasta src do ApontaAds-vercel (substituindo)
--           3) copie os 5 arquivos .js de  api-bundled/api/...  para  api/...  do ApontaAds-vercel (substituindo)
--           4) se ainda não fez: copie api/webhooks/rd-station.ts do projeto para o ApontaAds-vercel
--           5) apague do ApontaAds-vercel o arquivo antigo src/features/export/pdf/PdfLineChart.tsx (se existir)
--           6) faça o deploy normalmente e espere terminar com sucesso
-- ESPERAR:  deploy concluído, dashboard abrindo normalmente (Origem/mídia ainda como antes)
-- ============================================================================


-- ============================================================================
-- ETAPA 4 — Anotar o estado da integração do GA4
-- ONDE:     Supabase > SQL Editor
-- O QUE:    rode o bloco abaixo e GUARDE o resultado (tire um print ou copie o valor de last_synced_at)
-- ESPERAR:  uma linha, com last_synced_at preenchido e backfill_cursor vazio
-- ============================================================================
select id, key, status, last_synced_at, backfill_cursor from integrations where key = 'ga4';


-- ============================================================================
-- ETAPA 5 — Pedir a sincronização completa (180 dias) do GA4
-- ONDE:     Supabase > SQL Editor
-- O QUE:    rode o bloco abaixo
-- ESPERAR:  "Success", 1 linha afetada
-- ============================================================================
update integrations set last_synced_at = null, backfill_cursor = null where key = 'ga4';


-- ============================================================================
-- ETAPA 6 — Rodar a sincronização
-- ONDE:     no próprio sistema (não é SQL): Configurações > integração do GA4 > botão de sincronizar
-- O QUE:    clique UMA vez e deixe a aba aberta. O sistema faz sozinho as 6 etapas de 30 dias.
-- ESPERAR:  o botão voltar ao normal, e no histórico de sincronização aparecerem 6 linhas novas
--           (de hoje até ~180 dias atrás), todas "Sucesso". Se alguma terminar em erro, PARE e avise.
-- ============================================================================


-- ============================================================================
-- ETAPA 7 — Conferir
-- ONDE:     Supabase > SQL Editor
-- O QUE:    rode o bloco abaixo
-- ESPERAR:  duas linhas (origem e origem_pagina). A coluna "leads" das duas deve ser praticamente igual,
--           e min(date) de ambas deve chegar a cerca de 180 dias atrás.
--           Depois, no dashboard, a tabela Origem/mídia passa a mostrar a nota
--           "Só os cadastros dos formulários (com link cadastrado) das contas selecionadas".
-- ============================================================================
select kind, count(*) as linhas, sum(leads) as leads, min(date), max(date)
from analytics_lead_breakdown_daily where kind in ('origem', 'origem_pagina') group by kind;


-- ============================================================================
-- COMO DESFAZER (só se algo der errado — rode apenas o que precisar)
-- ============================================================================
-- Desfazer a etapa 5 (voltar a data de sincronização que você anotou na etapa 4):
--   update integrations set last_synced_at = '<valor anotado na etapa 4>', backfill_cursor = null where key = 'ga4';
--
-- Remover só os dados novos (o dashboard volta sozinho a mostrar a Origem/mídia sem filtro):
--   delete from analytics_lead_breakdown_daily where kind = 'origem_pagina';
--
-- Restaurar a tabela inteira a partir da cópia da etapa 1 (só se algo inesperado afetar os outros tipos):
--   delete from analytics_lead_breakdown_daily;
--   insert into analytics_lead_breakdown_daily select * from analytics_lead_breakdown_daily_bkp;
--
-- Voltar a regra de tipos da etapa 2 (só depois de remover os dados novos):
--   alter table analytics_lead_breakdown_daily drop constraint analytics_lead_breakdown_daily_kind_check;
--   alter table analytics_lead_breakdown_daily add constraint analytics_lead_breakdown_daily_kind_check
--     check (kind in ('caminho', 'origem', 'idade', 'genero', 'local', 'retorno', 'tempo'));
--
-- Depois de confirmar que está tudo certo, a cópia pode ser apagada:
--   drop table analytics_lead_breakdown_daily_bkp;
