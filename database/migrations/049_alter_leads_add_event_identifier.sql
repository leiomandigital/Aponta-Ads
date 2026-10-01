-- Identificador da conversão do RD Station (o "formulário") que gerou o lead.
-- Alimenta a tabela "Leads por formulário" do dashboard. Leads já gravados ficam
-- com null (o webhook não guardava esse dado) e aparecem como "(sem formulário)".
alter table leads add column event_identifier text;
