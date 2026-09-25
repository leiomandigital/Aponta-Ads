/**
 * Regra de gravação pedida: compara o dado novo com o que já está salvo pra
 * aquela chave — insere se não existe, atualiza se for diferente, ignora
 * (não grava nada) se for igual. Sem isso, todo ciclo de sincronização
 * reescrevia cada linha do zero mesmo quando nada mudou, o que também é
 * exatamente o que faria uma integração COMPARTILHADA (account_id nulo)
 * duplicar linha em vez de atualizar, se um dia o índice único não bater —
 * comparar antes de gravar reduz esse risco a zero, porque linhas idênticas
 * nem chegam a passar pelo upsert.
 *
 * Puro em JS de propósito — não sabe nada de Supabase. Cada normalize.ts
 * busca as linhas existentes (bem mais barato que reescrever a tabela
 * inteira: o lote de uma sincronização cobre no máximo ~30 dias) e chama
 * esta função pra decidir o que realmente precisa ir pro upsert.
 */
export function linhasParaGravar<T extends Record<string, unknown>>(
  linhasNovas: T[],
  linhasExistentes: T[],
  colunasChave: string[],
  colunasValor: string[]
): T[] {
  const chaveDe = (linha: T) => colunasChave.map((coluna) => String(linha[coluna])).join('|');
  const existentesPorChave = new Map(linhasExistentes.map((linha) => [chaveDe(linha), linha]));

  return linhasNovas.filter((linhaNova) => {
    const existente = existentesPorChave.get(chaveDe(linhaNova));
    if (!existente) return true; // não existe ainda -> insere
    return colunasValor.some((coluna) => linhaNova[coluna] !== existente[coluna]); // existe -> só grava se algum valor mudou
  });
}

/** Menor e maior data (string YYYY-MM-DD, comparável como texto) de um lote — usado pra restringir a busca das linhas existentes só ao intervalo que importa. */
export function intervaloDeDatas(datas: string[]): { min: string; max: string } {
  let min = datas[0];
  let max = datas[0];
  for (const data of datas) {
    if (data < min) min = data;
    if (data > max) max = data;
  }
  return { min, max };
}
