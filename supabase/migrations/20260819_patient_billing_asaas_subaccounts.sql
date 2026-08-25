-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: cobrança de paciente via subconta Asaas (OLI não é intermediário
-- recebedor — o dinheiro cai direto na subconta do médico).
--
-- reservations ganha patient_id + valor_consulta (hoje reserva de sala e
-- cadastro de paciente eram desconectados no banco).
-- professional_asaas_accounts: uma subconta Asaas por médico.
-- patient_charges: uma cobrança por reserva concluída.
--
-- Reaproveita oli_encrypt/oli_decrypt já criados em
-- 20260519_pgcrypto_financial.sql (chave via Vault OLI_PGCRYPTO_KEY).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES patients(id),
  ADD COLUMN IF NOT EXISTS valor_consulta numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_reservations_patient_id ON reservations(patient_id);

-- ── professional_asaas_accounts ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS professional_asaas_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id       uuid NOT NULL UNIQUE REFERENCES profiles(id),
  tipo_pessoa           text NOT NULL CHECK (tipo_pessoa IN ('pf','pj')),
  cpf_cnpj_hash         text,
  nome_completo         text,
  email                 text,
  telefone              text,
  endereco              jsonb,
  asaas_account_id      text,
  asaas_wallet_id       text,
  asaas_api_key_plain   text,
  asaas_api_key_enc     bytea,
  status                text NOT NULL DEFAULT 'rascunho'
                          CHECK (status IN ('rascunho','aguardando_aprovacao','aprovada','rejeitada','suspensa')),
  status_reason         text,
  submitted_at          timestamptz,
  approved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION trg_encrypt_professional_asaas_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.asaas_api_key_plain IS NOT NULL THEN
    NEW.asaas_api_key_enc   := oli_encrypt(NEW.asaas_api_key_plain);
    NEW.asaas_api_key_plain := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encrypt_professional_asaas_account ON professional_asaas_accounts;
CREATE TRIGGER encrypt_professional_asaas_account
  BEFORE INSERT OR UPDATE ON professional_asaas_accounts
  FOR EACH ROW EXECUTE FUNCTION trg_encrypt_professional_asaas_account();

ALTER TABLE professional_asaas_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_professional_asaas_accounts" ON professional_asaas_accounts
  FOR ALL USING (is_oli_admin()) WITH CHECK (is_oli_admin());

CREATE POLICY "professional_select_own_asaas_account" ON professional_asaas_accounts
  FOR SELECT USING (professional_id = auth.uid());

COMMENT ON TABLE professional_asaas_accounts IS
  'Subconta Asaas por médico — cobrança de paciente cai direto nela, OLI não é intermediário recebedor.';
COMMENT ON COLUMN professional_asaas_accounts.asaas_api_key_enc IS
  'Credencial da subconta, cifrada com oli_encrypt. Nunca ler/persistir em texto puro fora do momento da chamada à Asaas.';
COMMENT ON COLUMN professional_asaas_accounts.cpf_cnpj_hash IS
  'Hash do CPF/CNPJ para deduplicação — o valor real trafega só na hora do onboarding com a Asaas, não fica guardado em texto puro aqui.';

-- ── patient_charges ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_charges (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id        uuid NOT NULL REFERENCES profiles(id),
  patient_id             uuid NOT NULL REFERENCES patients(id),
  reservation_id         text NOT NULL UNIQUE REFERENCES reservations(id),
  valor                  numeric(10,2) NOT NULL,
  billing_type           text NOT NULL CHECK (billing_type IN ('PIX','BOLETO_BANCARIO','CREDIT_CARD')),
  asaas_payment_id_plain text,
  asaas_payment_id_enc   bytea,
  status                 text NOT NULL DEFAULT 'pendente'
                           CHECK (status IN ('pendente','pago','vencido','cancelado')),
  created_by             uuid REFERENCES profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  paid_at                timestamptz
);

CREATE INDEX IF NOT EXISTS idx_patient_charges_professional_id ON patient_charges(professional_id);
CREATE INDEX IF NOT EXISTS idx_patient_charges_patient_id ON patient_charges(patient_id);

CREATE OR REPLACE FUNCTION trg_encrypt_patient_charge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.asaas_payment_id_plain IS NOT NULL THEN
    NEW.asaas_payment_id_enc   := oli_encrypt(NEW.asaas_payment_id_plain);
    NEW.asaas_payment_id_plain := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encrypt_patient_charge ON patient_charges;
CREATE TRIGGER encrypt_patient_charge
  BEFORE INSERT OR UPDATE ON patient_charges
  FOR EACH ROW EXECUTE FUNCTION trg_encrypt_patient_charge();

ALTER TABLE patient_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_patient_charges" ON patient_charges
  FOR ALL USING (is_oli_admin()) WITH CHECK (is_oli_admin());

CREATE POLICY "professional_select_own_patient_charges" ON patient_charges
  FOR SELECT USING (professional_id = auth.uid());

COMMENT ON TABLE patient_charges IS
  'Cobrança de paciente gerada pela recepção ao finalizar uma consulta — dinheiro vai para a subconta Asaas do médico (professional_asaas_accounts), não para a conta master da OLI. UNIQUE(reservation_id): uma cobrança por reserva no v1.';
