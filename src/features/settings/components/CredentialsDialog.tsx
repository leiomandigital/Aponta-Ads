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
import type { Integration } from '@/types/database.types';

interface CredentialsDialogProps {
  integration: Integration;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvarComSucesso: () => Promise<void>;
}

export function CredentialsDialog({ integration, aberto, aoFechar, aoSalvarComSucesso }: CredentialsDialogProps) {
  const campos = CAMPOS_CREDENCIAL[integration.key] ?? [];
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);

    try {
      await credentialsService.salvar(integration.key, valores);
      setValores({});
      await aoSalvarComSucesso();
      aoFechar();
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao salvar credenciais');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar {integration.name}</DialogTitle>
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
