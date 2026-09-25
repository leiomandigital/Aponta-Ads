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
  /**
   * Renova o token OAuth2 se estiver perto de expirar. Roda sempre antes de
   * sync(). integrationId identifica a LINHA de `integrations` (não a
   * plataforma) — desde que uma key pode ter várias contas conectadas, é o
   * id que diz qual credencial ler/gravar no vault.
   */
  refreshCredentialsIfNeeded(integrationId: string): Promise<void>;
  /**
   * accountId é a conta dona desta integração (null quando a integração é
   * compartilhada) — repassado para carimbar account_id em cada linha
   * gravada pelo normalize.ts do conector.
   */
  sync(integrationId: string, accountId: string | null, options: SyncOptions): Promise<SyncResult>;
}
