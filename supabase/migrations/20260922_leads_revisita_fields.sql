-- Revisita da base herdada da agência anterior. Reconstruída em 02/10 a partir
-- do schema vivo (a migration foi aplicada direto no Supabase em 22/09 e o
-- arquivo nunca foi salvo). Se divergir do banco, o banco manda.
-- Eixo separado da esteira (`status`): um lead pode estar 'contatado' e ainda
-- não ter sido revisitado. NULL em revisita_status = fora da fila.
alter table leads
  add column if not exists lote text,
  add column if not exists revisita_status text,
  add column if not exists revisita_em timestamptz,
  add column if not exists revisita_por uuid,
  add column if not exists revisita_resultado text;

alter table leads
  add constraint leads_revisita_status_check
  check (revisita_status is null or revisita_status in
    ('pendente','em_andamento','respondeu','sem_retorno','encerrado'));
