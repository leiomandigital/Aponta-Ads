export type IntegrationKey = 'google_ads' | 'ga4' | 'meta_ads' | 'rd_station';

export interface SyncOptions {
  /** true enquanto o backfill de 180 dias não terminou — busca janela retroativa. */
  isBackfill?: boolean;
  /** Data (YYYY-MM-DD) a partir da qual buscar. */
  sinceDate: string;
  /** Data (YYYY-MM-DD) até a qual buscar — nunca "hoje" implícito, para não
   * misturar o intervalo de uma etapa de backfill com o de outra. */
  untilDate: string;
}

export interface SyncResult {
  status: 'success' | 'error' | 'partial';
  recordsSynced: number;
  errorMessage?: string;
  /** Resultado de cada sub-busca desta execução, ex: { ad_performance_daily: 'success', ad_conversions_daily: 'error: token expirado' } */
  details?: Record<string, string>;
  /** true = o backfill de 180 dias ainda não completou; quem chamou (dispatch.ts,
   * integrationsService.ts) deve disparar a próxima etapa. Preenchido pelo
   * syncRunner.ts, nunca pelos próprios conectores. */
  maisEtapas?: boolean;
}

export interface IntegrationConnector {
  key: IntegrationKey;
  /** Renova o token OAuth2 se estiver perto de expirar. Roda sempre antes de sync(). */
  refreshCredentialsIfNeeded(): Promise<void>;
  sync(options: SyncOptions): Promise<SyncResult>;
}
