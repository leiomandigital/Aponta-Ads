import { useRef, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrandSettings } from '../hooks/useBrandSettings';

export function BrandSettingsSection() {
  const { configuracoes, carregando, enviando, erro, enviarLogo } = useBrandSettings();
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const handleSelecionarArquivo = (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    if (arquivo) enviarLogo(arquivo);
  };

  if (carregando) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Marca</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marca</CardTitle>
        <CardDescription>Logo usada no cabeçalho do PDF exportado.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex items-center gap-4">
          {configuracoes?.client_logo_url ? (
            <img src={configuracoes.client_logo_url} alt="Logo do cliente" className="h-12 w-auto rounded border bg-white p-1" />
          ) : (
            <div className="flex h-12 w-24 items-center justify-center rounded border text-xs text-muted-foreground">
              Sem logo
            </div>
          )}
          <input ref={inputArquivoRef} type="file" accept="image/*" className="hidden" onChange={handleSelecionarArquivo} />
          <Button variant="outline" onClick={() => inputArquivoRef.current?.click()} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar logo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
