import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { integrationsService } from '../services/integrationsService';
import { formatarData, formatarDataHora } from '@/utils/formatters';
import type { SyncLog } from '@/types/database.types';

const ROTULO_STATUS: Record<SyncLog['status'], { texto: string; variante: 'success' | 'destructive' | 'warning' }> = {
  success: { texto: 'Sucesso', variante: 'success' },
  error: { texto: 'Erro', variante: 'destructive' },
  partial: { texto: 'Parcial', variante: 'warning' },
};

// Quanto pior, maior — decide o status "resumo" de um grupo de etapas: se
// qualquer etapa deu erro, o grupo é erro; senão, se alguma foi parcial, o
// grupo é parcial; só é sucesso se todas as etapas foram.
const GRAVIDADE: Record<SyncLog['status'], number> = { success: 0, partial: 1, error: 2 };

// Busca mais linhas brutas do que efetivamente serão exibidas, porque um
// backfill de 180 dias pode render até ~8 etapas dentro de um único grupo —
// sem essa folga, os grupos mais antigos apareceriam cortados pela metade.
const LIMITE_LOGS_BRUTOS = 60;
const LIMITE_EXECUCOES_EXIBIDAS = 15;

interface ExecucaoAgrupada {
  chave: string;
  status: SyncLog['status'];
  startedAt: string;
  finishedAt: string | null;
  recordsSynced: number;
  sinceDate: string | null;
  untilDate: string | null;
  etapas: SyncLog[];
}

/**
 * Um clique manual de "sincronizar agora" durante o backfill dispara várias
 * etapas (uma por chamada a /api/sync/dispatch) — cada uma já gravava sua
 * própria linha em sync_logs. run_id (migration 037) marca quais linhas
 * vieram do mesmo clique; sem run_id (sincronização automática, que nunca
 * precisa de mais de uma etapa por execução — ver syncRunner.ts), cada linha
 * já é o próprio grupo, sozinha.
 */
function agruparPorExecucao(logs: SyncLog[]): ExecucaoAgrupada[] {
  const grupos = new Map<string, SyncLog[]>();
  for (const log of logs) {
    const chave = log.run_id ?? log.id;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(log);
    else grupos.set(chave, [log]);
  }

  return Array.from(grupos.entries())
    .map(([chave, etapasBrutas]) => {
      const etapas = [...etapasBrutas].sort((a, b) => a.started_at.localeCompare(b.started_at));
      const status = etapas.reduce(
        (pior, log) => (GRAVIDADE[log.status] > GRAVIDADE[pior] ? log.status : pior),
        'success' as SyncLog['status']
      );
      const datasDesde = etapas.map((etapa) => etapa.since_date).filter((data): data is string => !!data);
      const datasAte = etapas.map((etapa) => etapa.until_date).filter((data): data is string => !!data);

      return {
        chave,
        status,
        startedAt: etapas[0].started_at,
        finishedAt: etapas[etapas.length - 1].finished_at,
        recordsSynced: etapas.reduce((soma, etapa) => soma + etapa.records_synced, 0),
        sinceDate: datasDesde.length > 0 ? datasDesde.reduce((min, data) => (data < min ? data : min)) : null,
        untilDate: datasAte.length > 0 ? datasAte.reduce((max, data) => (data > max ? data : max)) : null,
        etapas,
      };
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, LIMITE_EXECUCOES_EXIBIDAS);
}

interface SyncHistoryDialogProps {
  integrationId: string;
  aberto: boolean;
  aoFechar: () => void;
}

export function SyncHistoryDialog({ integrationId, aberto, aoFechar }: SyncHistoryDialogProps) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setErro(null);
    setExpandidas(new Set());
    integrationsService
      .listarUltimosLogs(integrationId, LIMITE_LOGS_BRUTOS)
      .then(setLogs)
      .catch((erroCapturado) => setErro(erroCapturado instanceof Error ? erroCapturado.message : 'Erro ao carregar histórico'))
      .finally(() => setCarregando(false));
  }, [aberto, integrationId]);

  const execucoes = useMemo(() => agruparPorExecucao(logs), [logs]);

  const alternarExpandida = (chave: string) => {
    setExpandidas((anteriores) => {
      const novo = new Set(anteriores);
      if (novo.has(chave)) {
        novo.delete(chave);
      } else {
        novo.add(chave);
      }
      return novo;
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de sincronização</DialogTitle>        
        </DialogHeader>

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : erro ? (
          <p className="text-sm text-destructive">{erro}</p>
        ) : execucoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada ainda.</p>
        ) : (
          <div className="flex max-h-96 flex-col divide-y overflow-y-auto">
            {execucoes.map((execucao) => {
              const status = ROTULO_STATUS[execucao.status];
              const temVariasEtapas = execucao.etapas.length > 1;
              const expandida = expandidas.has(execucao.chave);

              return (
                <div key={execucao.chave} className="py-2">
                  <button
                    type="button"
                    onClick={() => temVariasEtapas && alternarExpandida(execucao.chave)}
                    className={`flex w-full flex-col gap-1 text-left text-sm ${temVariasEtapas ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 font-medium">
                        {temVariasEtapas &&
                          (expandida ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          ))}
                        {formatarDataHora(execucao.startedAt)}
                        {temVariasEtapas && (
                          <span className="text-xs font-normal text-muted-foreground">
                            ({execucao.etapas.length} etapas)
                          </span>
                        )}
                      </span>
                      <Badge variant={status.variante}>{status.texto}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Buscou de {formatarData(execucao.sinceDate)} até {formatarData(execucao.untilDate)} —{' '}
                      {execucao.recordsSynced} {execucao.recordsSynced === 1 ? 'registro gravado' : 'registros gravados'}
                    </span>
                  </button>

                  {temVariasEtapas && expandida && (
                    <div className="ml-5 mt-2 flex flex-col gap-2 border-l pl-3">
                      {execucao.etapas.map((etapa) => {
                        const statusEtapa = ROTULO_STATUS[etapa.status];
                        return (
                          <div key={etapa.id} className="flex flex-col gap-0.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span>{formatarData(etapa.since_date)} até {formatarData(etapa.until_date)}</span>
                              <Badge variant={statusEtapa.variante}>{statusEtapa.texto}</Badge>
                            </div>
                            {etapa.details && (
                              <div className="text-muted-foreground">
                                {Object.entries(etapa.details).map(([tabela, resultado]) => (
                                  <div key={tabela}>
                                    {tabela}: {resultado}
                                  </div>
                                ))}
                              </div>
                            )}
                            {etapa.error_message && <span className="text-destructive">{etapa.error_message}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
