import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { rdStationLinksService, type LinkDeFormulario } from '../services/rdStationLinksService';

interface RdStationFormLinksDialogProps {
  integrationId: string;
  /** Conta em visualização na tela de Integrações — define quais formulários aparecem primeiro (os marcados nela). */
  contaEmVisualizacao: string | null;
  aberto: boolean;
  aoFechar: () => void;
}

/**
 * A RD Station não expõe a URL pública de formulário/LP/pop-up nem via API
 * nem no export de leads (testado contra /platform/embeddables e
 * /platform/landing_pages) — só dá pra preencher manualmente. O link é do
 * formulário, não da conta: preencher aqui vale pra toda conta que usa o
 * mesmo formulário. Por padrão mostra só os formulários marcados na conta em
 * visualização; "Mostrar outros links" revela o resto (pra cadastrar o link
 * de um formulário antes de selecioná-lo).
 */
export function RdStationFormLinksDialog({ integrationId, contaEmVisualizacao, aberto, aoFechar }: RdStationFormLinksDialogProps) {
  const [links, setLinks] = useState<LinkDeFormulario[]>([]);
  const [linksOriginais, setLinksOriginais] = useState<Record<string, string>>({});
  const [mostrarOutros, setMostrarOutros] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setErro(null);
    setMostrarOutros(false);
    rdStationLinksService
      .listar(integrationId, contaEmVisualizacao)
      .then((lista) => {
        setLinks(lista);
        setLinksOriginais(Object.fromEntries(lista.map((linha) => [linha.externalId, linha.linkUrl ?? ''])));
      })
      .catch((erroCapturado) => setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao listar links'))
      .finally(() => setCarregando(false));
  }, [aberto, integrationId, contaEmVisualizacao]);

  const selecionados = useMemo(() => links.filter((linha) => linha.selecionado), [links]);
  const outros = useMemo(() => links.filter((linha) => !linha.selecionado), [links]);

  const alterarLink = (externalId: string, linkUrl: string) => {
    setLinks((anteriores) => anteriores.map((linha) => (linha.externalId === externalId ? { ...linha, linkUrl } : linha)));
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      // Só o que foi alterado — evita sobrescrever um link que outra pessoa
      // tenha preenchido depois que este diálogo foi aberto.
      const alterados = links
        .filter((linha) => (linha.linkUrl ?? '') !== (linksOriginais[linha.externalId] ?? ''))
        .map((linha) => ({ externalId: linha.externalId, linkUrl: linha.linkUrl }));
      if (alterados.length > 0) await rdStationLinksService.salvar(integrationId, alterados);
      aoFechar();
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao salvar links');
    } finally {
      setSalvando(false);
    }
  };

  const renderCampo = (linha: LinkDeFormulario) => (
    <div key={linha.externalId} className="flex flex-col gap-1">
      <span className="text-sm font-medium">{linha.name}</span>
      <Input
        placeholder="https://exemplo.com.br/pagina"
        value={linha.linkUrl ?? ''}
        onChange={(evento) => alterarLink(linha.externalId, evento.target.value)}
      />
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Links dos formulários</DialogTitle>
          <DialogDescription>
            Cole o link de cada formulário selecionado nesta conta. O link vale para todas as contas que usam o mesmo formulário.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {selecionados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum formulário selecionado nesta conta ainda.</p>
            ) : (
              selecionados.map(renderCampo)
            )}

            {mostrarOutros && outros.length > 0 && (
              <div className="mt-2 flex flex-col gap-3 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">Outros formulários não selecionados nesta conta</p>
                {outros.map(renderCampo)}
              </div>
            )}
          </div>
        )}

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter className="flex-col items-end gap-2 sm:flex-col sm:items-end sm:space-x-0">
          {!carregando && outros.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto self-start p-0 text-xs text-muted-foreground"
              onClick={() => setMostrarOutros((anterior) => !anterior)}
            >
              {mostrarOutros ? 'Ocultar outros links' : 'Mostrar outros links'}
            </Button>
          )}
          <Button onClick={handleSalvar} disabled={salvando || carregando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
