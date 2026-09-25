import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { assetsService, type AtivoDisponivel } from '../services/assetsService';
import type { IntegrationKey } from '@/types/database.types';

interface AssetSelectionDialogProps {
  integrationId: string;
  integrationKey: IntegrationKey;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvarComSucesso: () => Promise<void>;
}

/**
 * Etapa 2 da conexão de GA4/RD Station: lista o que existe de verdade na
 * conta da plataforma e deixa escolher o que importar — nada é sincronizado
 * antes dessa escolha (ver assetSelection.ts no lado do servidor). Reaberta
 * a partir do IntegrationCard, a seleção pode ser editada a qualquer momento.
 */
export function AssetSelectionDialog({ integrationId, integrationKey, aberto, aoFechar, aoSalvarComSucesso }: AssetSelectionDialogProps) {
  const [ativos, setAtivos] = useState<AtivoDisponivel[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [selecaoUnica, setSelecaoUnica] = useState(integrationKey === 'ga4');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setErro(null);
    assetsService
      .listar(integrationId)
      .then((resposta) => {
        setAtivos(resposta.ativos);
        setSelecionados(new Set(resposta.selecionados));
        setSelecaoUnica(resposta.selecaoUnica);
      })
      .catch((erroCapturado) => setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao listar ativos disponíveis'))
      .finally(() => setCarregando(false));
  }, [aberto, integrationId]);

  const alternar = (externalId: string) => {
    setSelecionados((anteriores) => {
      if (selecaoUnica) return anteriores.has(externalId) ? new Set() : new Set([externalId]);
      const novo = new Set(anteriores);
      if (novo.has(externalId)) {
        novo.delete(externalId);
      } else {
        novo.add(externalId);
      }
      return novo;
    });
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const escolhidos = ativos.filter((ativo) => selecionados.has(ativo.externalId));
      await assetsService.salvar(integrationId, escolhidos);
      await aoSalvarComSucesso();
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao salvar seleção de ativos');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escolha o que importar</DialogTitle>
          <DialogDescription>
            {selecaoUnica
              ? 'Escolha qual propriedade esta conexão deve trazer.'
              : 'Marque quais páginas/identificadores esta conexão deve trazer — o resto é ignorado e não ocupa espaço no banco. Dá para editar depois.'}
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : ativos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum ativo encontrado nesta conta ainda.</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {ativos.map((ativo) => (
              <label key={ativo.externalId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selecionados.has(ativo.externalId)}
                  onChange={() => alternar(ativo.externalId)}
                />
                {ativo.name}
              </label>
            ))}
          </div>
        )}

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter>
          <Button onClick={handleSalvar} disabled={salvando || carregando || selecionados.size === 0}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            {salvando ? 'Salvando...' : 'Salvar seleção'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
