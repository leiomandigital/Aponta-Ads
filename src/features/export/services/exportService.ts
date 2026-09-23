import { supabase } from '@/lib/supabaseClient';

export interface ParametrosExportacaoPdf {
  aba: string;
  region: string;
  dataInicio: string;
  dataFim: string;
}

export const exportService = {
  /** Chama /api/export/pdf autenticado com o JWT do usuário e dispara o download. */
  async baixarPdf(parametros: ParametrosExportacaoPdf): Promise<void> {
    const { data: sessao } = await supabase.auth.getSession();
    const token = sessao.session?.access_token;
    if (!token) throw new Error('Sessão expirada — entre novamente para exportar');

    const resposta = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(parametros),
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}));
      throw new Error(corpo.error ?? 'Falha ao gerar o PDF');
    }

    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `apontaads-${parametros.aba}-${parametros.dataInicio}-a-${parametros.dataFim}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
