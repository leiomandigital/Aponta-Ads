import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegionMapping } from '../hooks/useRegionMapping';
import type { Region } from '@/types/database.types';

const ROTULO_PLATAFORMA: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

export function RegionMappingSection() {
  const { naoMapeadas, mapeadas, carregando, salvandoChave, erro, mapear, sugerirRegiao } = useRegionMapping();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapeamento de região</CardTitle>
        <CardDescription>
          Confirme a região (ES/TO) de cada campanha detectada. A sugestão pelo nome é só um ponto de partida.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {carregando ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : naoMapeadas.length === 0 && mapeadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma campanha detectada ainda — o mapeamento aparece aqui depois da primeira sincronização.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {naoMapeadas.map((campanha) => {
              const chave = `${campanha.platform}:${campanha.campaign_id}`;
              const sugestao = sugerirRegiao(campanha.campaign_name);

              return (
                <div key={chave} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{campanha.campaign_name ?? campanha.campaign_id}</span>
                    <Badge variant="secondary" className="w-fit">
                      {ROTULO_PLATAFORMA[campanha.platform] ?? campanha.platform}
                    </Badge>
                  </div>
                  <Select
                    defaultValue={sugestao ?? undefined}
                    onValueChange={(valor) => mapear(campanha.platform, campanha.campaign_id, campanha.campaign_name, valor as Region)}
                    disabled={salvandoChave === chave}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ES">Espírito Santo</SelectItem>
                      <SelectItem value="TO">Tocantins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}

            {mapeadas.map((mapeamento) => (
              <div key={mapeamento.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{mapeamento.campaign_name ?? mapeamento.campaign_id}</span>
                  <Badge variant="secondary" className="w-fit">
                    {ROTULO_PLATAFORMA[mapeamento.platform] ?? mapeamento.platform}
                  </Badge>
                </div>
                <Select
                  defaultValue={mapeamento.region}
                  onValueChange={(valor) =>
                    mapear(mapeamento.platform, mapeamento.campaign_id, mapeamento.campaign_name, valor as Region)
                  }
                  disabled={salvandoChave === `${mapeamento.platform}:${mapeamento.campaign_id}`}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ES">Espírito Santo</SelectItem>
                    <SelectItem value="TO">Tocantins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
