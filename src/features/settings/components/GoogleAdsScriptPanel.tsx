import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildGoogleAdsScript } from '../utils/googleAdsScriptTemplate';
import { AssetSelectionDialog } from './AssetSelectionDialog';

interface GoogleAdsScriptPanelProps {
  integrationId: string;
  spreadsheetId: string;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvarComSucesso: () => Promise<void>;
}

/**
 * Exibida logo depois que a URL da planilha é salva. Diferente de
 * GA4/RD Station, a seleção de conta (AssetSelectionDialog) não pode abrir
 * automaticamente — a planilha só tem dado depois que o usuário cola este
 * script no Google Ads e roda pelo menos uma vez.
 */
export function GoogleAdsScriptPanel({ integrationId, spreadsheetId, aberto, aoFechar, aoSalvarComSucesso }: GoogleAdsScriptPanelProps) {
  const script = useMemo(() => buildGoogleAdsScript(spreadsheetId), [spreadsheetId]);
  const [copiado, setCopiado] = useState(false);
  const [mostrarSelecaoDeConta, setMostrarSelecaoDeConta] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      const area = document.createElement('textarea');
      area.value = script;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (mostrarSelecaoDeConta) {
    return (
      <AssetSelectionDialog
        integrationId={integrationId}
        integrationKey="google_ads"
        aberto
        aoFechar={() => {
          setMostrarSelecaoDeConta(false);
          aoFechar();
        }}
        aoSalvarComSucesso={async () => {
          setMostrarSelecaoDeConta(false);
          await aoSalvarComSucesso();
        }}
      />
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      {/* grid-cols-[minmax(0,1fr)]: sem isso o bloco de código alarga a coluna do grid e vaza pra fora do modal */}
      <DialogContent className="max-h-[90vh] max-w-3xl grid-cols-[minmax(0,1fr)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure o Google Ads Script</DialogTitle>
          <DialogDescription>
            Cole este script dentro do Google Ads pra ele preencher a planilha com os dados — sem Client ID, Developer Token nem login
            OAuth.
          </DialogDescription>
        </DialogHeader>

        <ol className="list-outside list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Confirme que a planilha está compartilhada como <strong>"Qualquer pessoa com o link pode visualizar"</strong>
          </li>
          <li>
            No Google Ads, vá em <strong>Ferramentas e configurações → Ações em massa → Scripts</strong>
          </li>
          <li>
            Clique em <strong>+ Novo script</strong>, apague o conteúdo padrão e cole o código abaixo
          </li>
          <li>
            Salve, clique em <strong>Executar</strong> e autorize o acesso quando pedido
          </li>
          <li>
            Volte à lista de <strong>Scripts</strong> e, na coluna <strong>Frequência</strong> desse script, clique no lápis e escolha{' '}
            <strong>Diariamente</strong>, entre 0h e 2h
          </li>
        </ol>

        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <span className="font-mono text-xs text-zinc-400">apontaads-google-ads.js</span>
            <Button size="sm" variant="secondary" className="h-7" onClick={copiar}>
              {copiado ? <Check /> : <Copy />}
              {copiado ? 'Copiado!' : 'Copiar script'}
            </Button>
          </div>
          <pre className="max-h-72 overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-200">
            <code>{script}</code>
          </pre>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>
            Fazer isso depois
          </Button>
          <Button onClick={() => setMostrarSelecaoDeConta(true)}>Já rodei o script — selecionar conta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
