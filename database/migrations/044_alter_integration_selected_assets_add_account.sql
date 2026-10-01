-- Permite que uma integração COMPARTILHADA (integrations.account_id null)
-- ainda assim direcione cada identificador selecionado pra uma conta
-- específica — ex: RD Station compartilhado entre DNZ/TO/ES, mas o
-- identificador "Best Senior ES" deve gravar leads como sendo da conta ES,
-- não sem dono. null = comportamento antigo (usa integrations.account_id,
-- que é null quando compartilhada — lead sem conta atribuída).
alter table integration_selected_assets
  add column account_id uuid references accounts(id) on delete set null;
