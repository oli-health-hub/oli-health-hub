-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: mensageria via WhatsApp Business Cloud API (número único da OLI).
--
-- Schema compartilhado por dois casos de uso bem diferentes:
--   kind='lead'    → recrutamento de profissional (Meta/Google Ads), IA
--                     conversacional autônoma dentro do escopo.
--   kind='patient' → disparado por ação da recepção (confirmação/lembrete de
--                     consulta), sempre via template aprovado pela Meta.
--                     Nunca tem resposta autônoma de IA no v1 — toda resposta
--                     do paciente cai no inbox da recepção como conversa
--                     humana (chk_patient_never_ia garante isso no banco).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel          text NOT NULL DEFAULT 'whatsapp',
  kind             text NOT NULL CHECK (kind IN ('lead','patient','nao_classificada')),
  lead_id          uuid REFERENCES leads(id),
  patient_id       uuid REFERENCES patients(id),
  professional_id  uuid REFERENCES profiles(id),
  phone_e164       text NOT NULL,
  status           text NOT NULL DEFAULT 'humano' CHECK (status IN ('ia','humano','fechada')),
  assigned_to      uuid REFERENCES profiles(id),
  last_message_at  timestamptz,
  last_inbound_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_patient_never_ia CHECK (NOT (kind = 'patient' AND status = 'ia'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_e164);
CREATE INDEX IF NOT EXISTS idx_conversations_kind_status ON conversations(kind, status);

CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id),
  direction        text NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type      text NOT NULL CHECK (sender_type IN ('lead','patient','professional','ia','staff')),
  body             text,
  wamid            text UNIQUE,
  status           text NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada','entregue','lida','falhou')),
  template_name    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type        text NOT NULL UNIQUE CHECK (trigger_type IN ('confirmacao_consulta','lembrete_vespera')),
  meta_template_name  text NOT NULL,
  idioma              text NOT NULL DEFAULT 'pt_BR',
  corpo               text NOT NULL,
  variaveis           jsonb NOT NULL DEFAULT '[]'::jsonb,
  status_aprovacao    text NOT NULL DEFAULT 'rascunho' CHECK (status_aprovacao IN ('rascunho','pendente','aprovado','rejeitado')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_conversations" ON conversations FOR ALL USING (is_oli_admin()) WITH CHECK (is_oli_admin());
CREATE POLICY "admin_all_messages" ON messages FOR ALL USING (is_oli_admin()) WITH CHECK (is_oli_admin());
CREATE POLICY "admin_all_whatsapp_templates" ON whatsapp_templates FOR ALL USING (is_oli_admin()) WITH CHECK (is_oli_admin());

-- Mantém last_message_at/last_inbound_at em dia a cada mensagem nova —
-- last_inbound_at é o que controla a janela de 24h de resposta livre da Meta.
CREATE OR REPLACE FUNCTION trg_update_conversation_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = NEW.created_at,
         last_inbound_at = CASE WHEN NEW.direction = 'inbound' THEN NEW.created_at ELSE last_inbound_at END,
         updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_conversation_on_message ON messages;
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION trg_update_conversation_on_message();

COMMENT ON TABLE conversations IS
  'Conversa via WhatsApp Business Cloud API (número único da OLI). kind=patient nunca fica em status=ia no v1 (ver chk_patient_never_ia).';
COMMENT ON TABLE messages IS
  'Mensagens de uma conversa. wamid é o id da mensagem no WhatsApp — unique para dedup de reentrega do webhook do Meta.';
COMMENT ON TABLE whatsapp_templates IS
  'Templates pré-aprovados pela Meta para mensagens iniciadas pela OLI fora da janela de 24h. Rascunhos — status_aprovacao muda pra aprovado só depois da aprovação real no Meta Business Manager.';

INSERT INTO whatsapp_templates (trigger_type, meta_template_name, corpo, variaveis, status_aprovacao)
VALUES
  ('confirmacao_consulta', 'confirmacao_consulta_v1',
   'Olá {{1}}, sua consulta com {{2}} está confirmada para {{3}}, às {{4}}, no OLI Health Hub. Qualquer dúvida, estamos à disposição.',
   '["nome_paciente","nome_medico","data","horario"]'::jsonb, 'rascunho'),
  ('lembrete_vespera', 'lembrete_vespera_v1',
   'Olá {{1}}, lembramos que sua consulta com {{2}} está marcada para amanhã, {{3}}, às {{4}}. Em caso de imprevisto, entre em contato conosco com antecedência.',
   '["nome_paciente","nome_medico","data","horario"]'::jsonb, 'rascunho')
ON CONFLICT (trigger_type) DO NOTHING;
