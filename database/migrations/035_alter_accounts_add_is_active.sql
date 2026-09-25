-- Sem exclusão física de conta (decisão consciente) — o máximo que a tela
-- oferece é desativar. Uma conta desativada:
--   - some do seletor de conta do dashboard (não dá pra selecionar);
--   - seus dados próprios (account_id dela) somem da visão "Geral", do PDF
--     exportado e de qualquer somatória — ver dashboardService.ts e
--     reportData.ts, que passam a excluir explicitamente as contas inativas
--     quando accountId não é informado (visão "Geral");
--   - continua existindo no banco, com todo o histórico intacto — só a
--     agregação/seleção que passa a ignorá-la.
-- Dado compartilhado (account_id nulo) não é afetado por isso: desativar a
-- conta que originalmente marcou algo como compartilhado não tira o dado das
-- demais contas ainda ativas que dependem dele.
alter table accounts
  add column is_active boolean not null default true;
