import { useState } from 'react';
import { Download, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useExportPdf } from '../hooks/useExportPdf';
import { formatarData } from '@/utils/formatters';
import type { ParametrosExportacaoPdf } from '../services/exportService';

const ROTULO_ABA: Record<string, string> = {
  geral: 'Geral',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

interface ExportPdfButtonProps {
  parametros: ParametrosExportacaoPdf;
}

export function ExportPdfButton({ parametros }: ExportPdfButtonProps) {
  const [aberto, setAberto] = useState(false);
  const { exportar, exportando, erro } = useExportPdf();

  const handleExportar = async () => {
    try {
      await exportar(parametros);
      setAberto(false);
    } catch {
      // erro já fica disponível via useExportPdf().erro, dialog permanece aberto
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Exportar PDF">
          <FileDown className="h-4 w-4" />
          <span className="sr-only">Exportar PDF</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar relatório em PDF</DialogTitle>
          <DialogDescription>
            O PDF reproduz a visualização selecionada — exceto leads individuais (nome/e-mail nunca saem do painel).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 rounded-md border p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Aba</span>
            <span className="font-medium">{ROTULO_ABA[parametros.aba] ?? parametros.aba}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{parametros.accountIds && parametros.accountIds.length > 1 ? 'Contas' : 'Conta'}</span>
            <span className="text-right font-medium">{parametros.accountName ?? 'Todas as contas'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Período</span>
            <span className="font-medium">
              {formatarData(parametros.dataInicio)} a {formatarData(parametros.dataFim)}
            </span>
          </div>
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <DialogFooter>
          <Button onClick={handleExportar} disabled={exportando}>
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exportando ? 'Gerando PDF...' : 'Baixar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
