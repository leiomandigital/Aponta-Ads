import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { NOME_PADRAO_SISTEMA } from '@/lib/branding';
import { useBrandSettings } from '../hooks/useBrandSettings';

export function BrandSettingsSection() {
  const { configuracoes, carregando, enviando, erro, enviarLogo, salvarNome } = useBrandSettings();
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');

  // Sincroniza o campo com o que veio do banco só depois que carrega (e
  // quando o valor salvo muda) — sem isso, cada re-render apagaria o que o
  // usuário está digitando.
  useEffect(() => {
    setNome(configuracoes?.system_name ?? '');
  }, [configuracoes?.system_name]);

  const handleSelecionarArquivo = (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    if (arquivo) enviarLogo(arquivo);
  };

  const handleSalvarNome = (evento: FormEvent) => {
    evento.preventDefault();
    salvarNome(nome);
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
        <CardDescription>
          Logo e nome de apresentação usados no menu, na aba do navegador, no app instalado no celular e no PDF
          exportado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
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

        <form onSubmit={handleSalvarNome} className="flex flex-col gap-2">
          <Label htmlFor="nome-sistema">Nome do sistema</Label>
          <div className="flex gap-2">
            <Input
              id="nome-sistema"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder={NOME_PADRAO_SISTEMA}
              maxLength={60}
              className="max-w-xs"
            />
            <Button type="submit" variant="outline" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sem esse campo preenchido, o sistema aparece como &quot;{NOME_PADRAO_SISTEMA}&quot;.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
