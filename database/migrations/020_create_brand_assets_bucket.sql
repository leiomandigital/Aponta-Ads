-- Bucket para a logo do cliente (upload em Configurações → Marca). Só a logo
-- vive aqui — sem dado sensível, por isso é público: a URL pública é o que
-- preenche dashboard_settings.client_logo_url, usada no cabeçalho do PDF.
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

create policy "authenticated_pode_gravar_logo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'brand-assets');

create policy "authenticated_pode_atualizar_logo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'brand-assets');

create policy "qualquer_um_pode_ler_logo"
  on storage.objects for select
  using (bucket_id = 'brand-assets');
