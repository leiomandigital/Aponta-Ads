-- account_id nulo passa a significar "integração compartilhada" (também
-- chamada de "integração única" na tela de Configurações): usada
-- automaticamente por qualquer conta, sem precisar reconectar. account_id
-- preenchido significa integração própria daquela conta.
--
-- "on delete restrict": apagar uma conta com integrações amarradas a ela
-- deve falhar, nunca apagar credenciais em cascata sem querer — a tela de
-- Configurações não oferece exclusão de conta por enquanto (só criar e
-- renomear), então esta restrição nunca deveria disparar na prática.
--
-- As 4 linhas plantadas pela migration 001 viram propriedade da conta
-- padrão, não compartilhadas — preserva o comportamento atual (single-tenant)
-- até o usuário decidir explicitamente marcar alguma como compartilhada ao
-- cadastrar a segunda conta.
--
-- unique(key) ainda não é tocado aqui: integration_credentials (migration 002)
-- e sync_logs (migration 006) têm FK para integrations(key), e o Postgres não
-- deixa remover uma constraint única com FKs pendentes nela. Isso só acontece
-- na migration 029, depois que 027 e 028 migrarem essas FKs para integration_id.
alter table integrations
  add column account_id uuid references accounts(id) on delete restrict;

update integrations
  set account_id = (select id from accounts where is_default limit 1)
  where account_id is null;
