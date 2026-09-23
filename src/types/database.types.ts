export type Platform = 'google_ads' | 'meta_ads';
export type Region = 'ES' | 'TO';
export type IntegrationStatus = 'connected' | 'error' | 'pending' | 'disconnected';

export interface Integration {
  id: string;
  key: 'google_ads' | 'ga4' | 'meta_ads' | 'rd_station';
  name: string;
  is_active: boolean;
  status: IntegrationStatus;
  last_synced_at: string | null;
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
}

export interface LeadCostDaily {
  date: string;
  source: string | null;
  leads_count: number;
  total_cost: number;
  cost_per_lead: number | null;
}

export interface CampaignRegionMap {
  id: string;
  platform: string;
  campaign_id: string;
  campaign_name: string | null;
  region: Region;
}

export interface DashboardSettings {
  id: string;
  client_logo_url: string | null;
  brand_primary_color: string | null;
}

export interface SyncLog {
  id: string;
  integration_key: string;
  started_at: string;
  finished_at: string | null;
  status: 'success' | 'error' | 'partial';
  records_synced: number;
  error_message: string | null;
  details: Record<string, string> | null;
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
