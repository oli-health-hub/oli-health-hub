-- Canal do primeiro contato: como a equipe abordou o lead pela primeira vez.
--
-- Diferente de `origem`/`fonte` (de onde o lead VEIO — RD, Meta, WhatsApp,
-- site), este campo registra por onde a equipe FALOU com ele pela primeira
-- vez (WhatsApp, ligação, e-mail). Um lead pode vir do site e ser abordado
-- por ligação, por exemplo — são eixos independentes.
alter table leads add column if not exists canal_primeiro_contato text;

alter table leads drop constraint if exists leads_canal_primeiro_contato_valido;
alter table leads add constraint leads_canal_primeiro_contato_valido
  check (
    canal_primeiro_contato is null
    or canal_primeiro_contato = any (array['whatsapp', 'ligacao', 'email'])
  );
