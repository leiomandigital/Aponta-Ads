const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatadorNumero = new Intl.NumberFormat('pt-BR');
const formatadorPercentual = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatadorData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return formatadorMoeda.format(valor);
}

export function formatarNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return formatadorNumero.format(valor);
}

export function formatarPercentual(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return formatadorPercentual.format(valor);
}

// Padrão de data em toda a tela do sistema: dd/mm/aaaa. Aceita tanto uma
// data pura ("2026-09-18") quanto um timestamp ISO completo — uma data pura
// sem hora é ancorada em T00:00:00 local, senão o fuso do navegador pode
// exibir o dia anterior.
export function formatarData(data: string | Date | null | undefined): string {
  if (!data) return '—';
  const dataObj = typeof data === 'string' ? new Date(data.length <= 10 ? `${data}T00:00:00` : data) : data;
  if (Number.isNaN(dataObj.getTime())) return '—';
  return formatadorData.format(dataObj);
}

export function formatarDataHora(data: string | Date | null | undefined): string {
  if (!data) return '—';
  const dataObj = typeof data === 'string' ? new Date(data) : data;
  if (Number.isNaN(dataObj.getTime())) return '—';
  return formatadorDataHora.format(dataObj);
}

// Links de formulário do RD Station são salvos completos (ver
// integration_discovered_assets.link_url), mas telas como "Leads por
// formulário" mostram só o path (ex.: "/df-cotacao"), sem o domínio.
export function extrairPathDaUrl(url: string | null | undefined): string {
  if (!url) return '—';
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url; // não era uma URL válida — mostra o que tiver, não quebra a tela.
  }
}
