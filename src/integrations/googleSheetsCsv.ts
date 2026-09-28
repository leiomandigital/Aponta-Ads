// Leitura de planilhas públicas do Google Sheets como CSV — usado pelo fluxo
// Google Ads via Script (sem OAuth, ver google-ads/fetch.ts).

export function extrairIdDaPlanilha(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/** Parser CSV simplificado (RFC4180: aspas, vírgulas e quebras de linha dentro de campos). */
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let atual = '';
  let entreAspas = false;
  const colunas: string[] = [];

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (entreAspas && texto[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (c === ',' && !entreAspas) {
      colunas.push(atual);
      atual = '';
    } else if ((c === '\n' || c === '\r') && !entreAspas) {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      colunas.push(atual);
      atual = '';
      if (colunas.some((coluna) => coluna !== '')) linhas.push([...colunas]);
      colunas.length = 0;
    } else {
      atual += c;
    }
  }
  colunas.push(atual);
  if (colunas.some((coluna) => coluna !== '')) linhas.push(colunas);

  return linhas;
}

/** "1.234,56" (BR) ou "1,234.56" (US) → número. O Sheets reformata células conforme o locale da planilha. */
export function parseNumeroPlanilha(valor: string | undefined): number {
  if (!valor) return 0;
  let texto = valor.replace(/[^\d,.-]/g, '').trim();
  if (!texto) return 0;

  const temPonto = texto.includes('.');
  const temVirgula = texto.includes(',');
  if (temPonto && temVirgula) {
    texto = texto.lastIndexOf('.') > texto.lastIndexOf(',') ? texto.replace(/,/g, '') : texto.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    texto = texto.replace(',', '.');
  } else if (temPonto && /^\d{1,3}(\.\d{3})+$/.test(texto)) {
    texto = texto.replace(/\./g, '');
  }

  return parseFloat(texto) || 0;
}

/** Normaliza a data da célula para YYYY-MM-DD — o Sheets pode exibir/exportar em BR ou US dependendo do locale da planilha. */
export function parseDataPlanilha(valor: string | undefined): string | null {
  if (!valor) return null;
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const us = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return null;
}

/** Lê uma aba específica pelo nome via gviz — o endpoint /export sempre devolve a primeira aba, ignorando o parâmetro `sheet`. */
export async function buscarAba(sheetId: string, nomeAba: string): Promise<Record<string, string>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nomeAba)}`;
  const resposta = await fetch(url);
  if (!resposta.ok) return [];

  const linhas = parseCsv(await resposta.text());
  if (linhas.length < 2) return [];

  const cabecalho = linhas[0].map((coluna) => coluna.trim());
  return linhas.slice(1).map((linha) => {
    const objeto: Record<string, string> = {};
    cabecalho.forEach((coluna, indice) => {
      objeto[coluna] = linha[indice] ?? '';
    });
    return objeto;
  });
}
