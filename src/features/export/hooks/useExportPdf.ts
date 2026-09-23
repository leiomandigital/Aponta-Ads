import { useCallback, useState } from 'react';
import { exportService, type ParametrosExportacaoPdf } from '../services/exportService';

export function useExportPdf() {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const exportar = useCallback(async (parametros: ParametrosExportacaoPdf) => {
    setExportando(true);
    setErro(null);
    try {
      await exportService.baixarPdf(parametros);
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao exportar PDF');
      throw erroCapturado;
    } finally {
      setExportando(false);
    }
  }, []);

  return { exportar, exportando, erro };
}
