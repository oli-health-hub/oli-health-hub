-- ─── Audit Log — registro imutável de acesso a dados sensíveis ───────────────
-- LGPD Art. 37: obrigação de registro de operações de tratamento de dados.
-- Tabela append-only: RLS bloqueia UPDATE e DELETE para todos.

CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action          text NOT NULL,
  target_type     text NOT NULL,
  target_id       text,
  metadata        jsonb,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_professional ON audit_logs (professional_id, created_at DESC);
CREATE INDEX idx_audit_action       ON audit_logs (action, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_own" ON audit_logs
  FOR SELECT USING (professional_id = auth.uid());

CREATE POLICY "audit_insert_own" ON audit_logs
  FOR INSERT WITH CHECK (professional_id = auth.uid());

-- Tabela imutável — ninguém pode alterar ou remover registros
CREATE POLICY "audit_no_update" ON audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "audit_no_delete" ON audit_logs
  FOR DELETE USING (false);
