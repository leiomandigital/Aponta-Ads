-- Novo tipo de detalhamento dos leads do GA4: 'origem_pagina' = origem e mídia da sessão (dim1/dim2) + a PÁGINA onde o
-- generate_lead disparou (dim3). Com a página dá para mostrar a tabela Origem/mídia só dos formulários das contas
-- selecionadas (casando a página com o link de cada formulário), como já é feito nos caminhos até o lead.
--
-- O tipo antigo 'origem' (sem página) continua gravado e é usado como fallback enquanto o histórico do novo tipo não
-- foi completado pelo backfill. Esta migration só amplia a regra de tipos aceitos — não toca em nenhuma linha.
alter table analytics_lead_breakdown_daily drop constraint analytics_lead_breakdown_daily_kind_check;

alter table analytics_lead_breakdown_daily
  add constraint analytics_lead_breakdown_daily_kind_check
  check (kind in ('caminho', 'origem', 'origem_pagina', 'idade', 'genero', 'local', 'retorno', 'tempo'));
