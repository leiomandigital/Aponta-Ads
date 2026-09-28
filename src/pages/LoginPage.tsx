import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranding } from '@/lib/branding';

export function LoginPage() {
  const { autenticado, entrando, erro, entrar } = useAuth();
  const { nome } = useBranding();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const location = useLocation();

  if (autenticado) {
    const destino = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={destino} replace />;
  }

  const handleSubmit = async (evento: FormEvent) => {
    evento.preventDefault();
    try {
      await entrar(email, senha);
    } catch {
      // erro já fica disponível via useAuth().erro
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{nome}</CardTitle>
          <CardDescription>Entre com seu e-mail e senha para acessar o painel</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
              />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={entrando} className="w-full">
              {entrando ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
