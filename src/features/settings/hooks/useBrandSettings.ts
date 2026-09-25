import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { integrationsService } from '../services/integrationsService';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';

const BUCKET_LOGO = 'brand-assets';

export function useBrandSettings() {
  const { configuracoes, carregando, recarregar } = useDashboardSettings();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviarLogo = useCallback(
    async (arquivo: File) => {
      if (!configuracoes) return;
      setEnviando(true);
      setErro(null);

      try {
        const extensao = arquivo.name.split('.').pop() ?? 'png';
        const caminho = `logo-${Date.now()}.${extensao}`;

        const { error: erroUpload } = await supabase.storage.from(BUCKET_LOGO).upload(caminho, arquivo, { upsert: true });
        if (erroUpload) throw new Error(erroUpload.message);

        const { data } = supabase.storage.from(BUCKET_LOGO).getPublicUrl(caminho);
        await integrationsService.atualizarConfiguracoesDoDashboard(configuracoes.id, { client_logo_url: data.publicUrl });
        await recarregar();
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao enviar logo');
      } finally {
        setEnviando(false);
      }
    },
    [configuracoes, recarregar]
  );

  return { configuracoes, carregando, enviando, erro, enviarLogo };
}
