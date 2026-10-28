import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/DataTable';
import { useCostEntries } from '../hooks/useCostEntries';
import { formatarData, formatarMoeda } from '@/utils/formatters';
import type { CampaignCostEntry } from '@/types/database.types';
import type { ColumnDef } from '@tanstack/react-table';

type PlataformaDoLancamento = 'google_ads' | 'meta_ads';
type TipoDoLancamento = 'porcentagem' | 'valor';

interface FormularioLancamento {
  platform: PlataformaDoLancamento;
  kind: TipoDoLancamento;
  amount: string;
  description: string;
}

// Porcentagem é o tipo padrão; valor em R$ só quando o usuário seleciona.
const FORMULARIO_VAZIO: FormularioLancamento = { platform: 'google_ads', kind: 'porcentagem', amount: '', description: '' };

const ROTULO_PLATAFORMA: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  todas: 'Google Ads + Meta Ads (50/50)',
};

const formatarPercentual = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

interface CostEntriesSectionProps {
  accountId: string;
}

/**
 * Custos adicionais por plataforma (Google Ads ou Meta Ads), em porcentagem (padrão) ou valor em R$:
 *  - Google Ads: o adicional incide sobre o custo de mídia;
 *  - Meta Ads: o adicional incide sobre o custo com taxas (mídia + taxa automática).
 * O cálculo vive em valorDoLancamento (metricsAggregation.ts) e entra no "Custo total" do dashboard e do PDF.
 * A data é a do lançamento; o adicional vale para os períodos que incluem essa data.
 */
export function CostEntriesSection({ accountId }: CostEntriesSectionProps) {
  const { entradas, carregando, salvando, erro, criar, atualizar, excluir } = useCostEntries(accountId);

  const [form, setForm] = useState<FormularioLancamento>(FORMULARIO_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  const ehPorcentagem = form.kind === 'porcentagem';

  const iniciarEdicao = (entrada: CampaignCostEntry) => {
    setEditandoId(entrada.id);
    setErroValidacao(null);
    setForm({
      // lançamento antigo "50/50" não existe mais como opção: ao editar, o usuário escolhe uma plataforma
      platform: entrada.platform === 'meta_ads' ? 'meta_ads' : 'google_ads',
      kind: entrada.kind ?? 'valor',
      amount: String(entrada.amount).replace('.', ','),
      description: entrada.description ?? '',
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setErroValidacao(null);
    setForm(FORMULARIO_VAZIO);
  };

  const handleSalvar = async () => {
    const valor = Number(form.amount.replace(/\./g, '').replace(',', '.'));
    if (!valor || valor <= 0) {
      setErroValidacao(ehPorcentagem ? 'Informe uma porcentagem maior que zero.' : 'Informe um valor maior que zero.');
      return;
    }
    if (ehPorcentagem && valor > 1000) {
      setErroValidacao('A porcentagem informada é muito alta — confira o valor.');
      return;
    }
    setErroValidacao(null);

    const dados = {
      account_id: accountId,
      platform: form.platform,
      kind: form.kind,
      amount: valor,
      description: form.description.trim() || null,
    };

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
      { accessorKey: 'platform', header: 'Plataforma', cell: ({ row }) => ROTULO_PLATAFORMA[row.original.platform] ?? row.original.platform },
      {
        accessorKey: 'amount',
        header: 'Adicional',
        cell: ({ row }) =>
          row.original.kind === 'porcentagem' ? formatarPercentual(row.original.amount) : formatarMoeda(row.original.amount),
      },
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
          Adicional por plataforma, em porcentagem ou em valor (R$), somado ao "Custo total" do dashboard. No Google Ads ele incide sobre o
          custo de mídia; no Meta Ads, sobre o custo com taxas. A data é a do lançamento: o adicional vale para os períodos que incluem essa data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(erro || erroValidacao) && <p className="text-sm text-destructive">{erro ?? erroValidacao}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label>Plataforma</Label>
            <Select value={form.platform} onValueChange={(valor) => setForm((atual) => ({ ...atual, platform: valor as PlataformaDoLancamento }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tipo do adicional</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                variant={ehPorcentagem ? 'default' : 'outline'}
                onClick={() => setForm((atual) => ({ ...atual, kind: 'porcentagem' }))}
              >
                Porcentagem (%)
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                variant={!ehPorcentagem ? 'default' : 'outline'}
                onClick={() => setForm((atual) => ({ ...atual, kind: 'valor' }))}
              >
                Valor (R$)
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor-lancamento">{ehPorcentagem ? 'Porcentagem (%)' : 'Valor (R$)'}</Label>
            <Input
              id="valor-lancamento"
              inputMode="decimal"
              placeholder={ehPorcentagem ? 'Ex: 10' : '0,00'}
              value={form.amount}
              onChange={(evento) => setForm((atual) => ({ ...atual, amount: evento.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
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
