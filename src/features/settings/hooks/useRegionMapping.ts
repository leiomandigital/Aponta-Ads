import { useCallback, useEffect, useState } from 'react';
import { integrationsService } from '../services/integrationsService';
import type { CampaignRegionMap, Region } from '@/types/database.types';

interface CampanhaNaoMapeada {
  platform: string;
  campaign_id: string;
  campaign_name: string | null;
}

export function useRegionMapping() {
  const [naoMapeadas, setNaoMapeadas] = useState<CampanhaNaoMapeada[]>([]);
  const [mapeadas, setMapeadas] = useState<CampaignRegionMap[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoChave, setSalvandoChave] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaNaoMapeadas, listaMapeadas] = await Promise.all([
        integrationsService.listarCampanhasSemRegiao(),
        integrationsService.listarMapeamentosDeRegiao(),
      ]);
      setNaoMapeadas(listaNaoMapeadas);
      setMapeadas(listaMapeadas);
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar mapeamento de região');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const mapear = useCallback(
    async (platform: string, campaignId: string, campaignName: string | null, region: Region) => {
      const chave = `${platform}:${campaignId}`;
      setSalvandoChave(chave);
      try {
        await integrationsService.mapearRegiaoDaCampanha(platform, campaignId, campaignName, region);
        await buscar();
      } catch (erroCapturado) {
        setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao mapear região');
      } finally {
        setSalvandoChave(null);
      }
    },
    [buscar]
  );

  // Sugestão automática pré-marcada quando o nome contém "ES"/"TO" — o
  // usuário confirma ou corrige. Nunca gravada sozinha.
  const sugerirRegiao = useCallback((campaignName: string | null): Region | null => {
    const nome = campaignName?.toUpperCase() ?? '';
    if (nome.includes('ES')) return 'ES';
    if (nome.includes('TO')) return 'TO';
    return null;
  }, []);

  return { naoMapeadas, mapeadas, carregando, salvandoChave, erro, mapear, sugerirRegiao };
}
