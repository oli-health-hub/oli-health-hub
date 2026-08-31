-- Duas colunas novas em conversations pra organização do inbox /conversas:
-- admin_last_read_at marca quando a equipe viu a conversa pela última vez
-- (não lida = last_message_at mais recente que isso); last_message_direction
-- guarda o direction da última mensagem, pra saber de quem é a vez de
-- responder (inbound = aguardando nós, outbound = aguardando o contato) sem
-- precisar buscar a mensagem em si a cada render da lista.
alter table conversations add column if not exists admin_last_read_at timestamptz;
alter table conversations add column if not exists last_message_direction text
  check (last_message_direction in ('inbound','outbound'));

-- Backfill: direção da mensagem mais recente de cada conversa já existente.
update conversations c
set last_message_direction = m.direction
from (
  select distinct on (conversation_id) conversation_id, direction
  from messages
  order by conversation_id, created_at desc
) m
where m.conversation_id = c.id;

-- Mesmo trigger que já mantém last_message_at/last_inbound_at em dia
-- (20260819_whatsapp_conversations.sql) passa a também gravar a direção da
-- mensagem mais recente.
create or replace function trg_update_conversation_on_message()
returns trigger language plpgsql security definer as $$
begin
  update conversations
     set last_message_at = new.created_at,
         last_inbound_at = case when new.direction = 'inbound' then new.created_at else last_inbound_at end,
         last_message_direction = new.direction,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;
