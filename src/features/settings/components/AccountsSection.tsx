import { useState } from 'react';
import { Loader2, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '../hooks/useAccounts';
import type { Account } from '@/types/database.types';

interface AccountsSectionProps {
  accounts: Account[];
  /** ids de conta que já têm alguma integração — decide se o chip mostra excluir ou desativar. */
  idsComIntegracao: Set<string>;
  carregando: boolean;
  onCriar: ReturnType<typeof useAccounts>['criar'];
  onRenomear: ReturnType<typeof useAccounts>['renomear'];
  onAtivarDesativar: ReturnType<typeof useAccounts>['ativarDesativar'];
  onExcluir: ReturnType<typeof useAccounts>['excluir'];
  erro: string | null;
  salvando: boolean;
}

/**
 * Contas em chips numa linha só (quebra pra próxima linha se não couber) —
 * em vez de uma linha inteira por conta, que cresce sem limite conforme o
 * usuário cadastra mais unidades. Clicar no lápis de um chip vira ele um
 * input de edição, só daquele chip.
 *
 * Uma conta que NUNCA teve integração conectada pode ser excluída de
 * verdade (lixeira) — não tem nada vinculado a ela ainda. Assim que ela
 * ganha uma integração (mesmo desconectada depois), a exclusão deixa de ser
 * oferecida e vira só desativar/reativar (energia) — o banco também recusa a
 * exclusão nesse caso (on delete restrict), então isto aqui é só a UI
 * refletindo a mesma regra antes de tentar.
 */
export function AccountsSection({
  accounts,
  idsComIntegracao,
  carregando,
  onCriar,
  onRenomear,
  onAtivarDesativar,
  onExcluir,
  erro,
  salvando,
}: AccountsSectionProps) {
  const [nomeNovaConta, setNomeNovaConta] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');

  const handleCriar = async () => {
    const nome = nomeNovaConta.trim();
    if (!nome) return;
    const criada = await onCriar(nome);
    if (criada) setNomeNovaConta('');
  };

  const iniciarEdicao = (conta: Account) => {
    setEditandoId(conta.id);
    setNomeEdicao(conta.name);
  };

  const confirmarEdicao = async (id: string) => {
    const nome = nomeEdicao.trim();
    if (nome) await onRenomear(id, nome);
    setEditandoId(null);
  };

  const handleExcluir = (conta: Account) => {
    if (window.confirm(`Excluir a conta "${conta.name}"? Ela nunca teve nenhuma integração conectada, então isso não afeta nenhum dado.`)) {
      onExcluir(conta.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas</CardTitle>
        <CardDescription>Cada conta pode ter sua própria conta de anúncio por plataforma, ideal para separar unidades.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {carregando ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {accounts.map((conta) => {
              if (editandoId === conta.id) {
                return (
                  <Input
                    key={conta.id}
                    autoFocus
                    value={nomeEdicao}
                    onChange={(evento) => setNomeEdicao(evento.target.value)}
                    onKeyDown={(evento) => evento.key === 'Enter' && confirmarEdicao(conta.id)}
                    onBlur={() => confirmarEdicao(conta.id)}
                    className="h-8 w-[160px]"
                  />
                );
              }

              const temIntegracao = idsComIntegracao.has(conta.id);

              return (
                <div
                  key={conta.id}
                  className={`flex items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-sm font-medium transition-colors ${
                    conta.is_active ? 'bg-muted/40' : 'bg-muted/10 text-muted-foreground'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => iniciarEdicao(conta)}
                    className="flex items-center gap-1.5 hover:opacity-70"
                    title="Renomear"
                  >
                    {conta.name}
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  {temIntegracao ? (
                    <button
                      type="button"
                      onClick={() => onAtivarDesativar(conta.id, !conta.is_active)}
                      disabled={salvando}
                      className="rounded-full p-1 hover:bg-muted"
                      title={conta.is_active ? 'Desativar conta' : 'Reativar conta'}
                    >
                      {conta.is_active ? (
                        <Power className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <PowerOff className="h-3 w-3 text-destructive" />
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleExcluir(conta)}
                      disabled={salvando}
                      className="rounded-full p-1 hover:bg-muted"
                      title="Excluir conta (nunca teve integração conectada)"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Input
            placeholder="Nome da nova conta (ex: Tocantins)"
            value={nomeNovaConta}
            onChange={(evento) => setNomeNovaConta(evento.target.value)}
            onKeyDown={(evento) => evento.key === 'Enter' && handleCriar()}
            className="h-8 max-w-[280px]"
          />
          <Button size="sm" onClick={handleCriar} disabled={salvando || !nomeNovaConta.trim()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Cadastrar conta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
