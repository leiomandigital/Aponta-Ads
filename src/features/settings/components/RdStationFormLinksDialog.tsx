import { useEffect, useState } from 'react';
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
  aberto: boolean;
  aoFechar: () => void;
}

/**
 * A RD Station não expõe a URL pública de formulário/LP/pop-up nem via API
 * nem no export de leads (testado contra /platform/embeddables e
 * /platform/landing_pages) — só dá pra preencher manualmente. É por
 * integração, não por conta: o link do formulário é o mesmo pra todo mundo
 * que o importa. Guarda a URL completa; quem exibir no dashboard decide se
 * mostra só o path.
 */
export function RdStationFormLinksDialog({ integrationId, aberto, aoFechar }: RdStationFormLinksDialogProps) {
  const [links, setLinks] = useState<LinkDeFormulario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setErro(null);
    rdStationLinksService
      .listar(integrationId)
      .then(setLinks)
      .catch((erroCapturado) => setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao listar links'))
      .finally(() => setCarregando(false));
  }, [aberto, integrationId]);

  const alterarLink = (externalId: string, linkUrl: string) => {
    setLinks((anteriores) => anteriores.map((linha) => (linha.externalId === externalId ? { ...linha, linkUrl } : linha)));
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await rdStationLinksService.salvar(
        integrationId,
        links.map((linha) => ({ externalId: linha.externalId, linkUrl: linha.linkUrl }))
      );
      aoFechar();
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao salvar links');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Links dos formulários</DialogTitle>
          <DialogDescription>
            A RD Station não fornece a URL pública de cada formulário/LP/pop-up — cole aqui manualmente. Vale para todas as
            contas que usam esta integração.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum identificador descoberto ainda.</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {links.map((linha) => (
              <div key={linha.externalId} className="flex flex-col gap-1">
                <span className="text-sm font-medium">{linha.name}</span>
                <Input
                  placeholder="https://exemplo.com.br/pagina"
                  value={linha.linkUrl ?? ''}
                  onChange={(evento) => alterarLink(linha.externalId, evento.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter>
          <Button onClick={handleSalvar} disabled={salvando || carregando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
