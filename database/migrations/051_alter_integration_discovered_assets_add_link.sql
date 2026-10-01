-- Link público do formulário/LP/pop-up, preenchido manualmente pelo usuário
-- (a RD Station não expõe isso via API nem no export de leads — testado
-- contra /platform/embeddables e /platform/landing_pages, nenhum devolve
-- URL). Guarda a URL completa (ex.: https://bestsaude.com.br/df-cotacao);
-- quem for exibir no dashboard decide se mostra só o path.
alter table integration_discovered_assets add column link_url text;
