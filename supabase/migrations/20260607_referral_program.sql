-- ─────────────────────────────────────────────────────────────────────────────
-- Programa de Indicação (Referral)
-- ─────────────────────────────────────────────────────────────────────────────
-- Backend completo + automação server-side. Idempotente — seguro re-rodar.
--
-- Fluxo:
--   1. Profissional gera/possui referral_code (RPC generate_referral_code)
--   2. Indicado informa o indicador no onboarding (profiles.referido_por)
--   3. Ao COMPLETAR onboarding → trigger aplica benefício automático:
--      +60 min de crédito (90 dias) ao indicador, uma única vez.

-- ── Colunas em profiles ──────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referido_por  uuid REFERENCES profiles(id);

-- ── Tabela de indicações ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id       uuid NOT NULL REFERENCES profiles(id),
  indicado_id        uuid NOT NULL REFERENCES profiles(id),
  codigo             text,
  status             text DEFAULT 'active',
  beneficio_aplicado boolean DEFAULT false,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (indicador_id, indicado_id)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referrals_select_own" ON referrals;
CREATE POLICY "referrals_select_own" ON referrals
  FOR SELECT USING (auth.uid() = indicador_id OR auth.uid() = indicado_id);

-- ── RPC: gera código único de indicação ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Já tem? retorna
  SELECT referral_code INTO v_code FROM profiles WHERE id = p_user_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  -- Gera código de 6 chars alfanuméricos único
  LOOP
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  UPDATE profiles SET referral_code = v_code WHERE id = p_user_id;
  RETURN v_code;
END;
$$;

-- ── RPC: aplica benefício (idempotente) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_referral_benefit(p_referrer_id uuid, p_new_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_already BOOLEAN;
  v_code    TEXT;
BEGIN
  -- Idempotência: evita duplo crédito
  SELECT EXISTS(
    SELECT 1 FROM referrals
    WHERE indicador_id = p_referrer_id
      AND indicado_id  = p_new_user_id
      AND beneficio_aplicado = true
  ) INTO v_already;
  IF v_already THEN RETURN; END IF;

  SELECT COALESCE(referral_code, 'MANUAL') INTO v_code
  FROM profiles WHERE id = p_referrer_id;

  -- Crédito de 60 min, validade 90 dias
  INSERT INTO hour_balance (professional_id, minutos_total, minutos_usados, expira_em)
  VALUES (p_referrer_id, 60, 0, NOW() + INTERVAL '90 days');

  INSERT INTO referrals (codigo, indicador_id, indicado_id, status, beneficio_aplicado)
  VALUES (v_code, p_referrer_id, p_new_user_id, 'active', true)
  ON CONFLICT (indicador_id, indicado_id) DO UPDATE SET beneficio_aplicado = true;
END;
$$;

-- ── Automação: trigger ao completar onboarding ───────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_referral_on_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.onboarding_complete = true
     AND (OLD.onboarding_complete IS DISTINCT FROM true)
     AND NEW.referido_por IS NOT NULL
     AND NEW.referido_por <> NEW.id THEN
    PERFORM public.apply_referral_benefit(NEW.referido_por, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_on_onboarding ON public.profiles;
CREATE TRIGGER trg_referral_on_onboarding
  AFTER UPDATE OF onboarding_complete ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_referral_on_onboarding();
