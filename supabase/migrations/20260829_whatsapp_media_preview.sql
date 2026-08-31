-- Guarda a URL da imagem enviada/recebida numa mensagem, pra dar pra ver a
-- prévia depois no /conversas — sem isso, uma foto enviada pela equipe só
-- existe como texto genérico ("[imagem enviada pela equipe]"), sem jeito de
-- saber qual foi de fato mandada. Foto fixa da Olivia (FOTO_POR_ESPECIALIDADE)
-- reaproveita a mesma URL pública que ela já manda pro WhatsApp.
alter table messages add column if not exists media_url text;

insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;

drop policy if exists "whatsapp_media_admin_all" on storage.objects;
create policy "whatsapp_media_admin_all" on storage.objects
  for all
  using (bucket_id = 'whatsapp-media' and is_oli_admin())
  with check (bucket_id = 'whatsapp-media' and is_oli_admin());
