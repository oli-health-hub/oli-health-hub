-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: resolve_referral_code
-- ─────────────────────────────────────────────────────────────────────────────
-- Resolve um código de indicação (compartilhado pelo indicador) para o perfil
-- do indicador. Usado no onboarding do indicado quando ele chega via link/código
-- em vez de buscar pelo nome.
--
-- SECURITY DEFINER + retorno mínimo (id, nome) para não vazar dados de perfil.
-- Idempotente — seguro re-rodar.

CREATE OR REPLACE FUNCTION public.resolve_referral_code(p_code text)
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.nome
  FROM profiles p
  WHERE p.referral_code = upper(btrim(p_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO authenticated;
