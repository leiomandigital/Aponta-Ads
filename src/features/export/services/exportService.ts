import { supabase } from '@/lib/supabaseClient';

export interface ParametrosExportacaoPdf {
  aba: string;
  /** undefined = todas as contas. Lista = só essas, somadas (multi-seleção do dashboard). */
  accountIds?: string[];
  /** Só para exibição no diálogo/cabeçalho do PDF — o filtro de verdade é accountIds. */
  accountName?: string;
  dataInicio: string;
  dataFim: string;
}

/** Nome do arquivo vindo do servidor (usa o nome configurado em Configurações); null se o header não trouxer. */
function nomeDoArquivo(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* cai pro filename simples abaixo */
    }
  }
  return /filename="([^"]+)"/i.exec(contentDisposition)?.[1] ?? null;
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
    link.download = nomeDoArquivo(resposta.headers.get('Content-Disposition')) ?? `apontaads-${parametros.aba}-${parametros.dataInicio}-a-${parametros.dataFim}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
