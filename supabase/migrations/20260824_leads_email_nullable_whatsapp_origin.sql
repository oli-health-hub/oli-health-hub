-- E-mail deixa de ser obrigatório: leads originados de contato direto no
-- WhatsApp (origem='whatsapp', criados automaticamente pelo whatsapp-webhook
-- na primeira mensagem de um número desconhecido) só têm telefone no início.
-- O CHECK leads_tem_algum_contato (email OR whatsapp) já previa esse caso,
-- mas a coluna email continuava NOT NULL, impedindo o insert.
alter table public.leads alter column email drop not null;
