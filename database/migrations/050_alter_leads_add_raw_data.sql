-- Guarda o objeto "contact" inteiro que a RD Station manda no webhook
-- (telefone, cargo, empresa, tags, campos personalizados do formulário
-- cf_*, etc.) — hoje só um subconjunto fixo vira coluna própria. Não usamos
-- isso ainda em nenhuma tela, mas fica disponível pra quando precisar sem
-- ter que esperar chegar de novo (o webhook não reenvia histórico).
alter table leads add column raw_data jsonb;
