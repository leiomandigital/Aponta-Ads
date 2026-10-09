export type Platform = 'google_ads' | 'meta_ads';
export type Region = 'ES' | 'TO';
export type IntegrationStatus = 'connected' | 'error' | 'pending' | 'disconnected';
export type IntegrationKey = 'google_ads' | 'ga4' | 'meta_ads' | 'rd_station';

export interface Account {
  id: string;
  name: string;
  is_default: boolean;
  /** false = desativada: some do seletor do dashboard e de qualquer soma/relatório "Geral". Sem exclusão física de conta. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  key: IntegrationKey;
  name: string;
  is_active: boolean;
  status: IntegrationStatus;
  last_synced_at: string | null;
  /** null = integração compartilhada ("única"), usada por qualquer conta. */
  account_id: string | null;
  /** Conta que marcou como compartilhada — só ela pode desmarcar. null quando account_id não é nulo. */
  shared_from_account_id: string | null;
}

export interface IntegrationSelectedAsset {
  id: string;
  integration_id: string;
  external_id: string;
  name: string | null;
}

export interface AdPerformanceDaily {
  id: string;
  platform: Platform;
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  region: Region | null;
  account_id: string | null;
}

export interface AnalyticsSessionsDaily {
  id: string;
  date: string;
  sessions: number;
  users: number;
  conversions: number;
  leads: number;
  page_path: string | null;
  device: string | null;
  age_range: string | null;
  gender: string | null;
  traffic_type: string | null;
  region: Region | null;
  account_id: string | null;
}

export interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  source: string | null;
  funnel_stage: string | null;
  region: Region | null;
  captured_at: string | null;
  created_at: string;
  account_id: string | null;
}

/** Leads por dia/origem/conta, contados direto da tabela leads (vw_leads_diario). */
export interface LeadsDiario {
  date: string;
  source: string | null;
  account_id: string | null;
  leads_count: number;
}

export interface LeadCostDaily {
  date: string;
  source: string | null;
  account_id: string | null;
  leads_count: number;
  total_cost: number;
  cost_per_lead: number | null;
}

export interface DashboardSettings {
  id: string;
  client_logo_url: string | null;
  system_name: string | null;
}

export interface SyncLog {
  id: string;
  integration_key: string;
  integration_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: 'success' | 'error' | 'partial';
  records_synced: number;
  error_message: string | null;
  details: Record<string, string> | null;
  since_date: string | null;
  until_date: string | null;
  /** Igual em todas as etapas de um mesmo clique manual (backfill dividido em várias chamadas) — nulo na automática, que nunca precisa disso. */
  run_id: string | null;
}

export interface AggregatedMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
}

/** Lançamento manual de custo avulso (ex: sessão de fotos) — taxa da plataforma é calculada automaticamente, não lançada aqui. */
export interface CampaignCostEntry {
  id: string;
  account_id: string | null;
  /** 'todas' = lançamento dividido 50/50 entre Google Ads e Meta Ads (ver dashboardService.obterLancamentosDeCusto). */
  platform: Platform | 'todas';
  /** null = lançamento geral da plataforma/conta no período, não atribuído a uma campanha específica. */
  campaign_id: string | null;
  amount: number;
  date: string;
  description: string | null;
  created_at: string;
}

/** Custo em cascata: mídia (automático) → +taxas da plataforma → +custos avulsos. */
export interface CostBreakdown {
  costMidia: number;
  costComTaxas: number;
  costTotal: number;
}
