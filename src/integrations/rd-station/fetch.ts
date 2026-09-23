import type { RDStationCredentials } from './auth.js';

interface RDStationConversion {
  uuid: string;
  name?: string;
  email: string;
  created_at: string; // timestamp real do lead, devolvido pela própria API
  legal_bases?: unknown;
  cf_utm_source?: string;
  cf_utm_campaign?: string;
  lifecycle_stage?: string;
}

/** Paginado — a API devolve `next_page_token` enquanto houver mais resultados. */
export async function buscarConversoes(
  credenciais: RDStationCredentials,
  sinceDate: string,
  untilDate: string
): Promise<RDStationConversion[]> {
  const conversoes: RDStationConversion[] = [];
  let proximoToken: string | undefined;

  do {
    const parametros = new URLSearchParams({
      event_type: 'CONVERSION',
      start_date: sinceDate,
      end_date: untilDate,
      ...(proximoToken ? { page_token: proximoToken } : {}),
    });

    const resposta = await fetch(`https://api.rd.services/platform/conversions?${parametros}`, {
      headers: { Authorization: `Bearer ${credenciais.accessToken}` },
    });

    if (!resposta.ok) {
      throw new Error(`RD Station: consulta de conversões falhou (HTTP ${resposta.status})`);
    }

    const corpo = (await resposta.json()) as { conversions?: RDStationConversion[]; next_page_token?: string };
    conversoes.push(...(corpo.conversions ?? []));
    proximoToken = corpo.next_page_token;
  } while (proximoToken);

  return conversoes;
}
