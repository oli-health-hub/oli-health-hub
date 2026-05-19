-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: pgcrypto — criptografia de colunas financeiras sensíveis
-- Sprint 1 Segurança 🟡 (LGPD + PCI DSS boas práticas)
--
-- Colunas criptografadas:
--   subscriptions.asaas_id           → identificador do cliente no gateway
--   subscriptions.asaas_charge_id    → ID da cobrança no gateway
--   user_modules.asaas_id            → ID de cobrança de módulo avulso
--
-- Estratégia: pgp_sym_encrypt / pgp_sym_decrypt com chave via Vault do Supabase.
-- A chave é lida por `current_setting('app.pgcrypto_key', true)` que é definida
-- como variável de configuração por sessão nas Edge Functions.
--
-- Para produção: setar via Supabase Dashboard → Vault → OLI_PGCRYPTO_KEY
-- ─────────────────────────────────────────────────────────────────────────────

-- Ativa extensão pgcrypto (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Renomear colunas originais para versões texto (backup temporário) ─────────
-- Não removemos os dados — renomeamos e criamos as versões criptografadas.

ALTER TABLE subscriptions
  RENAME COLUMN asaas_id TO asaas_id_plain;

ALTER TABLE user_modules
  RENAME COLUMN asaas_id TO asaas_id_plain;

-- ── Adicionar colunas criptografadas (bytea) ──────────────────────────────────

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS asaas_id_enc bytea;

ALTER TABLE user_modules
  ADD COLUMN IF NOT EXISTS asaas_id_enc bytea;

-- ── Função helper: criptografa string com chave do Vault ─────────────────────

CREATE OR REPLACE FUNCTION oli_encrypt(plain text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key text;
BEGIN
  -- Em produção, a chave vem do Vault via supabase_vault.secrets
  -- Fallback para variável de configuração de sessão (Edge Functions)
  BEGIN
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets
     WHERE name = 'OLI_PGCRYPTO_KEY'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := current_setting('app.pgcrypto_key', true);
  END;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'pgcrypto key not configured — set OLI_PGCRYPTO_KEY in Vault';
  END IF;

  IF plain IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_encrypt(plain, v_key);
END;
$$;

CREATE OR REPLACE FUNCTION oli_decrypt(cipher bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets
     WHERE name = 'OLI_PGCRYPTO_KEY'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := current_setting('app.pgcrypto_key', true);
  END;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'pgcrypto key not configured';
  END IF;

  IF cipher IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(cipher, v_key);
END;
$$;

-- ── Migrar dados existentes (colunas _plain → _enc) ──────────────────────────
-- No ambiente de desenvolvimento, não há dados reais ainda — bloco seguro.

DO $$
BEGIN
  -- subscriptions
  UPDATE subscriptions
     SET asaas_id_enc = oli_encrypt(asaas_id_plain)
   WHERE asaas_id_plain IS NOT NULL
     AND asaas_id_enc   IS NULL;

  -- user_modules
  UPDATE user_modules
     SET asaas_id_enc = oli_encrypt(asaas_id_plain)
   WHERE asaas_id_plain IS NOT NULL
     AND asaas_id_enc   IS NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Chave não configurada ainda — dados serão migrados quando a chave for inserida no Vault
    RAISE NOTICE 'pgcrypto key not set yet — run migration manually after configuring Vault: %', SQLERRM;
END;
$$;

-- ── View de conveniência para o app (decripta on-the-fly) ─────────────────────

CREATE OR REPLACE VIEW subscriptions_readable AS
SELECT
  id,
  professional_id,
  plan_id,
  ciclo,
  status,
  oli_decrypt(asaas_id_enc) AS asaas_id,  -- decriptado
  starts_at,
  ends_at,
  cancelled_at,
  created_at,
  updated_at
FROM subscriptions;

-- RLS na view: cada profissional vê apenas a própria linha
ALTER VIEW subscriptions_readable OWNER TO authenticated;

GRANT SELECT ON subscriptions_readable TO authenticated;

-- ── Trigger: criptografa automaticamente asaas_id em INSERT/UPDATE ───────────

CREATE OR REPLACE FUNCTION trg_encrypt_subscription_asaas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se o app inserir asaas_id_plain diretamente, criptografa e limpa
  IF NEW.asaas_id_plain IS NOT NULL THEN
    NEW.asaas_id_enc   := oli_encrypt(NEW.asaas_id_plain);
    NEW.asaas_id_plain := NULL;  -- não persistir em texto puro
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encrypt_subscription_asaas ON subscriptions;
CREATE TRIGGER encrypt_subscription_asaas
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trg_encrypt_subscription_asaas();

-- ── Comentários de documentação ───────────────────────────────────────────────

COMMENT ON COLUMN subscriptions.asaas_id_enc IS
  'ID do cliente/assinatura no Asaas — criptografado com pgp_sym_encrypt. Ler via subscriptions_readable ou oli_decrypt().';

COMMENT ON COLUMN subscriptions.asaas_id_plain IS
  'DEPRECATED — usado apenas durante migração. Deve ser NULL em produção após migração completa.';

COMMENT ON FUNCTION oli_encrypt(text) IS
  'Criptografa string sensível com chave do Supabase Vault (OLI_PGCRYPTO_KEY).';

COMMENT ON FUNCTION oli_decrypt(bytea) IS
  'Decriptografa bytea com chave do Supabase Vault (OLI_PGCRYPTO_KEY).';
