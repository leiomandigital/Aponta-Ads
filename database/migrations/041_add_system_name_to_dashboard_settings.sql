-- Nome de apresentação white-label (Configurações → Marca). Some em todo
-- lugar que hoje mostra "ApontaAds" fixo — menu, aba do navegador, manifest
-- do PWA (nome do app no celular) e cabeçalho/rodapé do PDF exportado. Nulo
-- = usa o padrão "ApontaAds" (ver NOME_PADRAO_SISTEMA em src/lib/branding.ts).
alter table dashboard_settings
  add column system_name text;
