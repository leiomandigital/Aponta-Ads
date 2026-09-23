const FUSO_HORARIO_CLIENTE = 'America/Sao_Paulo';
const APENAS_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza um timestamp (ISO, UTC ou já em outro fuso) para a data
 * (YYYY-MM-DD) correspondente em America/Sao_Paulo. Toda coluna `date`
 * gravada por um conector deve passar por aqui antes do upsert — ver
 * Integration Connector Pattern Skill, seção 7.
 */
export function paraDataSaoPaulo(timestamp: string | Date): string {
  // Data sem horário já é o dia de calendário na conta/propriedade da plataforma.
  // Convertê-la como meia-noite UTC recuaria um dia em São Paulo (UTC-3).
  if (typeof timestamp === 'string' && APENAS_DATA.test(timestamp)) return timestamp;

  const data = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_HORARIO_CLIENTE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatador.format(data); // en-CA formata como YYYY-MM-DD
}
