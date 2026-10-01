-- Preenche integration_discovered_assets.link_url com os links extraídos da
-- tela "Integração de formulário" da RD Station (48 formulários, 46 nomes
-- únicos). Upsert: atualiza quem já existe (descoberto via webhook/CSV) e
-- cria a linha pra quem ainda não tem nenhuma conversão registrada, já com
-- o link — assim fica pronto mesmo antes de a primeira conversão chegar.
--
-- Rodar manualmente no SQL Editor do Supabase.

insert into integration_discovered_assets (integration_id, external_id, name, link_url)
select
  (select id from integrations where key = 'rd_station' limit 1),
  v.nome,
  v.nome,
  v.link
from (values
  ('Senior DF Promocional', 'https://bestsaude.com.br/df-cotacao'),
  ('DR Promocional PME', 'https://bestsaude.com.br/df-cotacao-empresarial'),
  ('Formulário Senior DF 1', 'https://bestsaude.com.br/df-cotacao'),
  ('Formulário Ceará 1', 'https://bestsaude.com.br/cotacao-ceara'),
  ('Fale Conosco 1', 'https://bestsaude.com.br/fale-conosco'),
  ('Tocantins empresarial 6', 'https://bestsaude.com.br/formulario-tocantins-pme-pmax'),
  ('Formulário Senior DF', 'https://bestsaude.com.br/df-cotacao'),
  ('Senior Tocantins 4', 'https://bestsaude.com.br/formulario-tocantins-senior-pesquisa'),
  ('Best Senior ES 2', 'https://bestsaude.com.br/formulario-es-meta'),
  ('Best Senior ES 5', 'https://bestsaude.com.br/formulario-es-google-youtube'),
  ('Tocantins empresarial 7', 'https://bestsaude.com.br/formulario-tocantins-pme-pesquisa'),
  ('Best Senior ES 3', 'https://bestsaude.com.br/formulario-es-google-pesquisa'),
  ('Best Senior ES 4', 'https://bestsaude.com.br/formulario-es-google-pmax'),
  ('Senior Tocantins 3', 'https://bestsaude.com.br/formulario-tocantins-senior-pmax'),
  ('Senior Tocantins 2', 'https://bestsaude.com.br/formulario-tocantins-senior-meta'),
  ('Best Senior ES 1', 'https://bestsaude.com.br/cotacao-espirito-santo'),
  ('Form. Tocantins Adesão 1', 'https://bestsaude.com.br/cotacao'),
  ('Form. Tocantins Empresarial 1', 'https://bestsaude.com.br/cotacao'),
  ('Formulário Empresarial DF', 'https://bestsaude.com.br/df-cotacao-empresarial'),
  ('Formulário Cuiabá 1', 'https://bestsaude.com.br/cotacao-cuiaba'),
  ('Tocantins empresarial 5', 'https://bestsaude.com.br/cotacao-ceara-empresarial'),
  ('Formulário Cotação Ceará', 'https://bestsaude.com.br/cotacao-ceara'),
  ('Form duvidas 1', 'https://bestsaude.com.br/duvidas-frequentes'),
  ('Senior Tocantins 1', 'https://bestsaude.com.br/cotacao-tocantins-senior'),
  ('Tocantins empresarial 4', 'https://bestsaude.com.br/cotacao-tocantins-empresarial'),
  ('Adesão', 'https://bestsaude.com.br/tocantins-coletivo-por-adesao'),
  ('Formulário Senior Empresarial CE', 'https://bestsaude.com.br/cotacao-ceara-empresarial'),
  ('Form. Best Senior Ceará 1', 'https://bestsaude.com.br/cotacao'),
  ('Form. Best Senior site 1', 'https://bestsaude.com.br/cotacao'),
  ('Best Senior ES Empresarial 1', 'https://bestsaude.com.br/cotacao-es-empresarial'),
  ('Tocantins empresarial 3', 'https://bestsaude.com.br/tocantins-coletivo-por-adesao'),
  ('Best Senior ES Empresarial', 'https://bestsaude.com.br/cotacao-es-empresarial'),
  ('Tocantins empresarial 1', 'https://bestsaude.com.br/cotacao-tocantins-empresarial'),
  ('Formulário Cuiabá', 'https://bestsaude.com.br/cotacao-cuiaba'),
  ('Form duvidas', 'https://bestsaude.com.br/duvidas-frequentes'),
  ('Form. de cotação', 'https://bestsenior.com.br/cotacao/'),
  ('/duvidas-frequentes/', 'https://bestsenior.com.br/duvidas-frequentes/'),
  ('Tocantins empresarial', 'https://bestsaude.com.br/cotacao-tocantins-empresarial'),
  ('Fale Conosco', 'https://bestsaude.com.br/fale-conosco'),
  ('Best Senior ES', 'https://bestsaude.com.br/cotacao-espirito-santo'),
  ('Senior Tocantins', 'https://bestsaude.com.br/cotacao-tocantins-senior'),
  ('Form. Best Senior Ceará', 'https://bestsaude.com.br/cotacao'),
  ('Adesão Form', 'https://bestsaude.com.br/cotacao'),
  ('Form. Best Senior site', 'https://bestsaude.com.br/cotacao'),
  ('Form. Tocantins Empresarial', 'https://bestsaude.com.br/cotacao'),
  ('Form. Tocantins Adesão', 'https://bestsaude.com.br/cotacao')
) as v(nome, link)
on conflict (integration_id, external_id)
do update set link_url = excluded.link_url;
