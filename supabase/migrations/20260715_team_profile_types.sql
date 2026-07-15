-- Libera user_type para perfis de equipe (founder/especialista/parceiro) —
-- não são médicos, servem só pra ter presença na Comunidade do app,
-- gerenciados via admin/app/equipe.
alter table profiles drop constraint profiles_user_type_check;
alter table profiles add constraint profiles_user_type_check
  check (user_type = any (array['subscriber','hour_user','admin','founder','specialist','partner']));
