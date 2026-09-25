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
  // CONFIRME contra a documentação/conta real: nome exato do campo que a API
  // devolve para o "identificador de conversão" (formulário/página de
  // origem). Usado só pela seleção de ativos (assetSelection.ts) — se o nome
  // real for outro, listarIdentificadoresDisponiveis()/o filtro abaixo
  // precisam ser ajustados.
  conversion_identifier?: string;
}

const DIAS_AMOSTRA_IDENTIFICADORES = 30;

async function buscarPagina(
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

/**
 * Paginado — a API devolve `next_page_token` enquanto houver mais resultados.
 * `identificadoresSelecionados` vem de assetSelection.ts:
 *   - undefined → não filtra (compatibilidade com integração já conectada
 *     antes da seleção de ativos existir).
 *   - array (mesmo vazio) → filtra estritamente a esses identificadores.
 */
export async function buscarConversoes(
  credenciais: RDStationCredentials,
  sinceDate: string,
  untilDate: string,
  identificadoresSelecionados?: string[]
): Promise<RDStationConversion[]> {
  if (identificadoresSelecionados?.length === 0) return [];

  const conversoes = await buscarPagina(credenciais, sinceDate, untilDate);

  if (!identificadoresSelecionados) return conversoes;

  const permitidos = new Set(identificadoresSelecionados);
  return conversoes.filter((conversao) => conversao.conversion_identifier && permitidos.has(conversao.conversion_identifier));
}

/**
 * Não existe, no que já foi usado neste projeto, um endpoint confirmado de
 * "listar formulários/páginas" do RD Station — a lista de ativos disponíveis
 * pra escolher na tela de seleção vem de uma AMOSTRA dos últimos 30 dias de
 * conversões, extraindo os identificadores distintos que aparecerem. Isso é
 * uma aproximação: um formulário sem nenhuma conversão recente não vai
 * aparecer na lista. Validar contra uma conta real do RD Station ao testar —
 * se a API tiver um endpoint de metadados melhor, trocar por ele aqui.
 */
export async function listarIdentificadoresDisponiveis(
  credenciais: RDStationCredentials
): Promise<Array<{ externalId: string; name: string }>> {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - DIAS_AMOSTRA_IDENTIFICADORES);

  const formatarData = (data: Date) => data.toISOString().slice(0, 10);
  const conversoes = await buscarPagina(credenciais, formatarData(inicio), formatarData(hoje));

  const identificadores = new Set<string>();
  for (const conversao of conversoes) {
    if (conversao.conversion_identifier) identificadores.add(conversao.conversion_identifier);
  }

  return [...identificadores].sort().map((externalId) => ({ externalId, name: externalId }));
}
