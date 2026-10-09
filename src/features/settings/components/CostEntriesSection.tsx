import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/DataTable';
import { useCostEntries } from '../hooks/useCostEntries';
import { formatarData, formatarMoeda } from '@/utils/formatters';
import type { CampaignCostEntry } from '@/types/database.types';
import type { ColumnDef } from '@tanstack/react-table';

interface FormularioLancamento {
  amount: string;
  description: string;
}

const FORMULARIO_VAZIO: FormularioLancamento = { amount: '', description: '' };

interface CostEntriesSectionProps {
  accountId: string;
}

/**
 * Custos avulsos manuais (ex: sessão de fotos do produto) que a mídia não
 * mostra sozinha — somam-se ao custo automático no dashboard em cascata:
 * Custo de mídia → +taxa automática da plataforma → +custos avulsos daqui
 * (ver TAXA_PLATAFORMA_META em metricsAggregation.ts pra taxa). O lançamento
 * é só valor + descrição: a data é a do lançamento e o valor é dividido 50%
 * Google Ads / 50% Meta Ads (ver dashboardService.obterLancamentosDeCusto).
 */
export function CostEntriesSection({ accountId }: CostEntriesSectionProps) {
  const { entradas, carregando, salvando, erro, criar, atualizar, excluir } = useCostEntries(accountId);

  const [form, setForm] = useState<FormularioLancamento>(FORMULARIO_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  const iniciarEdicao = (entrada: CampaignCostEntry) => {
    setEditandoId(entrada.id);
    setErroValidacao(null);
    setForm({ amount: String(entrada.amount), description: entrada.description ?? '' });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setErroValidacao(null);
    setForm(FORMULARIO_VAZIO);
  };

  const handleSalvar = async () => {
    const valor = Number(form.amount.replace(',', '.'));
    if (!valor || valor <= 0) {
      setErroValidacao('Informe um valor maior que zero.');
      return;
    }
    setErroValidacao(null);

    const dados = { account_id: accountId, amount: valor, description: form.description.trim() || null };

    const sucesso = editandoId ? await atualizar(editandoId, dados) : await criar(dados);
    if (sucesso) {
      setEditandoId(null);
      setForm(FORMULARIO_VAZIO);
    }
  };

  const handleExcluir = (entrada: CampaignCostEntry) => {
    if (window.confirm('Excluir este lançamento de custo? Ele deixa de contar no dashboard imediatamente.')) {
      excluir(entrada.id);
      if (editandoId === entrada.id) cancelarEdicao();
    }
  };

  const colunas = useMemo<ColumnDef<CampaignCostEntry, unknown>[]>(
    () => [
      { accessorKey: 'date', header: 'Data', cell: ({ row }) => formatarData(row.original.date) },
      { accessorKey: 'amount', header: 'Valor', cell: ({ row }) => formatarMoeda(row.original.amount) },
      { accessorKey: 'description', header: 'Descrição', cell: ({ row }) => row.original.description ?? '—' },
      {
        id: 'acoes',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => iniciarEdicao(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Excluir" onClick={() => handleExcluir(row.original)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editandoId]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custos adicionais</CardTitle>
        <CardDescription>
          Custos avulsos (ex: sessão de fotos do produto) que a mídia não mostra sozinha, somam-se ao custo automático no card "Custo
          total" do dashboard. O valor é dividido automaticamente: 50% para o Google Ads e 50% para o Meta Ads. A data é a do lançamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(erro || erroValidacao) && <p className="text-sm text-destructive">{erro ?? erroValidacao}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor-lancamento">Valor</Label>
            <Input
              id="valor-lancamento"
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(evento) => setForm((atual) => ({ ...atual, amount: evento.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="descricao-lancamento">Descrição (opcional)</Label>
            <Input
              id="descricao-lancamento"
              placeholder="Ex: sessão de fotos do produto"
              value={form.description}
              onChange={(evento) => setForm((atual) => ({ ...atual, description: evento.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSalvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editandoId ? 'Salvar alteração' : 'Lançar custo'}
          </Button>
          {editandoId && (
            <Button size="sm" variant="ghost" onClick={cancelarEdicao} disabled={salvando}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          )}
        </div>

        <DataTable columns={colunas} data={entradas} carregando={carregando} mensagemVazio="nenhum custo adicional lançado ainda" />
      </CardContent>
    </Card>
  );
}
