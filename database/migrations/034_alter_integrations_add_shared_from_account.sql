-- Guarda de qual conta partiu a decisão de marcar uma integração como
-- compartilhada. Sem isso, assim que account_id vira null (compartilhada),
-- não sobra nenhum jeito de saber quem foi que compartilhou — e qualquer
-- conta que enxerga a integração poderia desmarcar, inclusive uma conta que
-- nunca teve nada a ver com ela. Regra de negócio: só a conta registrada
-- aqui pode desmarcar (o controle aparece desabilitado nas demais — ver
-- IntegrationCard.tsx). Fica null de novo assim que a integração volta a ser
-- exclusiva de uma conta (deixa de fazer sentido guardar "quem compartilhou"
-- algo que não está mais compartilhado).
alter table integrations
  add column shared_from_account_id uuid references accounts(id) on delete set null;
