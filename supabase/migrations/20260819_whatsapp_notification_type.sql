-- ALTER TYPE ... ADD VALUE não pode rodar na mesma transação que usa o valor
-- novo — por isso fica isolado neste arquivo, separado das migrations que
-- inserem admin_notifications com type='whatsapp_message_received'.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'whatsapp_message_received';
