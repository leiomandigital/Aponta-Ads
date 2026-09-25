import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CAMPOS_CREDENCIAL } from '../constants/credentialFields';
import { credentialsService } from '../services/credentialsService';
import { AssetSelectionDialog } from './AssetSelectionDialog';
import type { IntegrationKey } from '@/types/database.types';

// GA4 e RD Station exigem uma etapa extra depois de salvar a credencial:
// escolher qual propriedade/quais identificadores importar (ver
// AssetSelectionDialog). Google Ads e Meta Ads seguem no fluxo de 1 passo só.
const PLATAFORMAS_COM_SELECAO_DE_ATIVOS: IntegrationKey[] = ['ga4', 'rd_station'];

interface CredentialsDialogProps {
  integrationKey: IntegrationKey;
  integrationName: string;
  /** undefined = ainda não existe linha de integrations para esta conta/plataforma — o backend cria ao salvar. */
  integrationId?: string;
  /** Conta selecionada no momento — só usada quando integrationId ainda não existe. */
  accountId: string;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvarComSucesso: () => Promise<void>;
}

export function CredentialsDialog({
  integrationKey,
  integrationName,
  integrationId,
  accountId,
  aberto,
  aoFechar,
  aoSalvarComSucesso,
}: CredentialsDialogProps) {
  const campos = CAMPOS_CREDENCIAL[integrationKey] ?? [];
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [idParaSelecaoDeAtivos, setIdParaSelecaoDeAtivos] = useState<string | null>(null);

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);

    try {
      const resultado = await credentialsService.salvar({
        integrationId,
        integrationKey: integrationId ? undefined : integrationKey,
        accountId: integrationId ? undefined : accountId,
        payload: valores,
      });
      setValores({});

      if (PLATAFORMAS_COM_SELECAO_DE_ATIVOS.includes(integrationKey)) {
        setIdParaSelecaoDeAtivos(resultado.integrationId);
      } else {
        await aoSalvarComSucesso();
        aoFechar();
      }
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao salvar credenciais');
    } finally {
      setSalvando(false);
    }
  };

  if (idParaSelecaoDeAtivos) {
    return (
      <AssetSelectionDialog
        integrationId={idParaSelecaoDeAtivos}
        integrationKey={integrationKey}
        aberto
        aoFechar={() => {
          setIdParaSelecaoDeAtivos(null);
          aoFechar();
        }}
        aoSalvarComSucesso={async () => {
          setIdParaSelecaoDeAtivos(null);
          await aoSalvarComSucesso();
          aoFechar();
        }}
      />
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar {integrationName}</DialogTitle>
          <DialogDescription>
            As credenciais são gravadas criptografadas e nunca são exibidas de novo depois de salvas — reenviar sempre sobrescreve.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {campos.map((campo) => (
            <div key={campo.chave} className="flex flex-col gap-1.5">
              <Label htmlFor={campo.chave}>
                {campo.rotulo}
                {!campo.obrigatorio && <span className="text-muted-foreground"> (opcional)</span>}
              </Label>
              <Input
                id={campo.chave}
                type={campo.tipo}
                required={campo.obrigatorio}
                autoComplete="off"
                value={valores[campo.chave] ?? ''}
                onChange={(evento) => setValores((anteriores) => ({ ...anteriores, [campo.chave]: evento.target.value }))}
              />
            </div>
          ))}
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <DialogFooter>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            {salvando ? 'Salvando...' : 'Salvar e conectar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
