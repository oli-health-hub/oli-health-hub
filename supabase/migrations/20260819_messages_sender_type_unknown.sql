-- Conversa kind='nao_classificada' (telefone que não bate com paciente nem
-- lead cadastrado) precisa de um sender_type próprio — nenhum dos existentes
-- ('lead','patient','professional','ia','staff') descreve corretamente quem
-- mandou a primeira mensagem de um número desconhecido.
ALTER TABLE messages DROP CONSTRAINT messages_sender_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check
  CHECK (sender_type IN ('lead','patient','professional','ia','staff','unknown'));
