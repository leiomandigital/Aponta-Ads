export const ABAS_DASHBOARD = [
  { valor: 'geral', rotulo: 'Geral' },
  { valor: 'google_ads', rotulo: 'Google Ads' },
  { valor: 'meta_ads', rotulo: 'Meta Ads' },
  { valor: 'analytics', rotulo: 'Analytics' },
] as const;

export type AbaDashboard = (typeof ABAS_DASHBOARD)[number]['valor'];

export const PERIODOS_DASHBOARD = [
  { valor: '7d', rotulo: '7 dias', dias: 7 },
  { valor: '30d', rotulo: '30 dias', dias: 30 },
  { valor: '90d', rotulo: '90 dias', dias: 90 },
] as const;

// 'custom' não entra em PERIODOS_DASHBOARD (essa lista é só as linhas de
// preset do PeriodPicker) — o intervalo customizado vem de um estado próprio.
export type PeriodoDashboard = (typeof PERIODOS_DASHBOARD)[number]['valor'] | 'custom';

export const REGIOES_DASHBOARD = [
  { valor: 'todas', rotulo: 'Todas as regiões' },
  { valor: 'ES', rotulo: 'Espírito Santo' },
  { valor: 'TO', rotulo: 'Tocantins' },
] as const;

export type RegiaoDashboard = (typeof REGIOES_DASHBOARD)[number]['valor'];
