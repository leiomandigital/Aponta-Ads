-- Guarda o payload do lead da ocorrência mais recente de cada identificador
-- descoberto — necessário pra gravar retroativamente em `leads` quando o
-- usuário seleciona um identificador DEPOIS que a primeira conversão dele já
-- chegou (sem isso, essa primeira conversão nunca virava lead, só descobria
-- o identificador). Guarda só a última ocorrência, não um histórico — se
-- várias conversões não selecionadas chegarem antes da seleção, só a mais
-- recente é recuperável.
alter table integration_discovered_assets add column last_payload jsonb;
