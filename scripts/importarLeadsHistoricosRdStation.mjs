// Importação ÚNICA do histórico de leads exportado da RD Station (CSV "todos
// os contatos da base"), pra dentro da mesma fila de pendentes que o webhook
// usa (rd_station_pending_leads) — não escreve direto em `leads`. Cada lead
// fica pendente sob CADA identificador de formulário em que converteu
// ("Eventos (Últimos 100)"); quando alguém selecionar esse identificador pra
// uma conta na tela "Escolha o que importar", o mecanismo que já existe
// (save-assets.ts) grava o lead na conta certa — sem lógica nova de UI.
//
// Uso:
//   node --env-file=.env scripts/importarLeadsHistoricosRdStation.mjs "<caminho do csv>" [--integration-id <uuid>] [--dry-run]
//
// O CSV da RD Station vem em UTF-16LE, separado por TAB (apesar da extensão
// .csv) — decodificado abaixo. Nunca loga dado pessoal no console, só
// contagens/progresso.

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';

const TAMANHO_LOTE = 500;

function erroFatal(mensagem) {
  console.error(`Erro: ${mensagem}`);
  process.exit(1);
}

function lerArgs() {
  const args = process.argv.slice(2);
  const caminhoCsv = args.find((arg) => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const indiceIntegrationId = args.indexOf('--integration-id');
  const integrationId = indiceIntegrationId >= 0 ? args[indiceIntegrationId + 1] : undefined;

  if (!caminhoCsv) {
    erroFatal('informe o caminho do CSV como argumento. Ex: node --env-file=.env scripts/importarLeadsHistoricosRdStation.mjs "C:\\caminho\\arquivo.csv"');
  }

  return { caminhoCsv, dryRun, integrationId };
}

function lerCsvUtf16Tab(caminho) {
  const buffer = readFileSync(caminho);
  let texto = buffer.toString('utf16le');
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // remove BOM

  return parse(texto, {
    delimiter: '\t',
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
}

// "2026-09-30 10:52:20 -0300" -> "2026-09-30T10:52:20-03:00" (ISO válido).
function parseDataRd(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  if (!m) return null;
  const [, data, hora, offH, offM] = m;
  return `${data}T${hora}${offH}:${offM}`;
}

function extrairUuidDaUrlPublica(urlPublica) {
  if (!urlPublica) return null;
  const partes = urlPublica.trim().split('/').filter(Boolean);
  const ultimo = partes[partes.length - 1];
  return ultimo && /^[0-9a-f-]{36}$/i.test(ultimo) ? ultimo : null;
}

// Tudo que não virou campo dedicado do RDStationWebhookLead fica aqui —
// robusto a variação de campos personalizados entre formulários, sem
// precisar listar cada cf_* um por um.
const CAMPOS_JA_MAPEADOS = new Set([
  'Email',
  'Nome',
  'Estágio no funil',
  'URL pública',
  'Data da última conversão',
  'Data da primeira conversão',
  'Origem da última conversão',
  'Eventos (Últimos 100)',
]);

function montarRawContact(registro) {
  const raw = {};
  for (const [chave, valor] of Object.entries(registro)) {
    if (CAMPOS_JA_MAPEADOS.has(chave)) continue;
    if (valor === '' || valor === '""') continue;
    raw[chave] = valor;
  }
  return raw;
}

async function main() {
  const { caminhoCsv, dryRun, integrationId: integrationIdArg } = lerArgs();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    erroFatal('rode com --env-file=.env (precisa de VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente)');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let integrationId = integrationIdArg;
  if (!integrationId) {
    const { data: integracoes, error } = await supabase.from('integrations').select('id, account_id, name').eq('key', 'rd_station');
    if (error) erroFatal(error.message);
    if (!integracoes || integracoes.length === 0) erroFatal('nenhuma integração rd_station encontrada');
    if (integracoes.length > 1) {
      console.error('Mais de uma integração rd_station encontrada — rode de novo passando --integration-id <uuid>:');
      for (const integracao of integracoes) console.error(`  ${integracao.id} (account_id: ${integracao.account_id ?? 'compartilhada'})`);
      process.exit(1);
    }
    integrationId = integracoes[0].id;
  }
  console.log(`Usando integrationId: ${integrationId}${dryRun ? ' (dry-run — nada será gravado)' : ''}`);

  console.log('Lendo e parseando o CSV...');
  const registros = lerCsvUtf16Tab(caminhoCsv);
  console.log(`${registros.length} linhas encontradas.`);

  const identificadoresGlobais = new Set();
  const linhasPendentes = []; // { external_id, payload }
  let semUuid = 0;
  let semEventos = 0;
  let semData = 0;

  for (const registro of registros) {
    const uuid = extrairUuidDaUrlPublica(registro['URL pública']);
    const email = (registro['Email'] ?? '').trim();
    if (!uuid || !email) {
      semUuid += 1;
      continue;
    }

    const eventos = (registro['Eventos (Últimos 100)'] ?? '')
      .split('/')
      .map((parte) => parte.trim())
      .filter(Boolean);
    const identificadoresUnicos = [...new Set(eventos)];
    if (identificadoresUnicos.length === 0) {
      semEventos += 1;
      continue;
    }

    const dataEvento =
      parseDataRd(registro['Data da última conversão']) ?? parseDataRd(registro['Data da primeira conversão']);
    if (!dataEvento) semData += 1;

    const leadBase = {
      uuid,
      email,
      name: registro['Nome']?.trim() || undefined,
      eventTimestamp: dataEvento ?? new Date().toISOString(),
      lifecycleStage: registro['Estágio no funil']?.trim() || undefined,
      origin: registro['Origem da última conversão']?.trim() || undefined,
      rawContact: montarRawContact(registro),
    };

    for (const identificador of identificadoresUnicos) {
      identificadoresGlobais.add(identificador);
      linhasPendentes.push({
        external_id: identificador,
        payload: { ...leadBase, eventIdentifier: identificador },
      });
    }
  }

  console.log(`Leads válidos: ${registros.length - semUuid - semEventos}.`);
  console.log(`Ignorados sem uuid/email: ${semUuid}. Ignorados sem nenhum evento identificável: ${semEventos}.`);
  console.log(`Sem data de conversão (usou agora como fallback): ${semData}.`);
  console.log(`Identificadores distintos encontrados: ${identificadoresGlobais.size}.`);
  console.log(`Linhas a enfileirar em rd_station_pending_leads: ${linhasPendentes.length}.`);

  if (dryRun) {
    console.log('Dry-run — nada foi gravado. Identificadores encontrados:');
    console.log([...identificadoresGlobais].sort().join('\n'));
    return;
  }

  console.log('Registrando identificadores em integration_discovered_assets...');
  const linhasDescoberta = [...identificadoresGlobais].map((externalId) => ({
    integration_id: integrationId,
    external_id: externalId,
    name: externalId,
  }));
  for (let i = 0; i < linhasDescoberta.length; i += TAMANHO_LOTE) {
    const lote = linhasDescoberta.slice(i, i + TAMANHO_LOTE);
    const { error } = await supabase
      .from('integration_discovered_assets')
      .upsert(lote, { onConflict: 'integration_id,external_id', ignoreDuplicates: true });
    if (error) erroFatal(`upsert de descobertos falhou: ${error.message}`);
  }
  console.log('Identificadores registrados.');

  console.log('Enfileirando leads pendentes...');
  for (let i = 0; i < linhasPendentes.length; i += TAMANHO_LOTE) {
    const lote = linhasPendentes.slice(i, i + TAMANHO_LOTE).map((linha) => ({
      integration_id: integrationId,
      external_id: linha.external_id,
      payload: linha.payload,
    }));
    const { error } = await supabase.from('rd_station_pending_leads').insert(lote);
    if (error) erroFatal(`insert de pendentes falhou no lote ${i}: ${error.message}`);
    console.log(`  ${Math.min(i + TAMANHO_LOTE, linhasPendentes.length)}/${linhasPendentes.length}`);
  }

  console.log('Concluído. Agora é só ir em Configurações > RD Station > "Escolha o que importar" em cada conta e marcar os identificadores dela.');
}

main().catch((erro) => erroFatal(erro instanceof Error ? erro.message : String(erro)));
