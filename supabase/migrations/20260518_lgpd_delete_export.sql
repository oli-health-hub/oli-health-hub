-- ─────────────────────────────────────────────────────────────────────────────
-- OLI Health Hub — LGPD Art. 18: Exclusão e Portabilidade de Dados
-- Migration: 20260518_lgpd_delete_export
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Função: delete_account_data ───────────────────────────────────────────────
-- Exclui todos os dados pessoais do profissional em cascade.
-- Chamada via RPC pelo app na tela de Perfil > Excluir Conta.
-- Somente o próprio usuário pode excluir seus dados.

CREATE OR REPLACE FUNCTION delete_account_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_deleted_patients  integer := 0;
  v_deleted_reserv    integer := 0;
  v_deleted_charges   integer := 0;
  v_deleted_onboard   integer := 0;
BEGIN
  -- Valida que só o próprio usuário chama esta função
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: only the account owner can delete their data';
  END IF;

  -- Apaga pacientes (dados sensíveis de saúde)
  DELETE FROM patients WHERE professional_id = p_user_id;
  GET DIAGNOSTICS v_deleted_patients = ROW_COUNT;

  -- Apaga reservas
  DELETE FROM reservations WHERE professional_id = p_user_id;
  GET DIAGNOSTICS v_deleted_reserv = ROW_COUNT;

  -- Apaga usage_charges
  DELETE FROM usage_charges WHERE professional_id = p_user_id;
  GET DIAGNOSTICS v_deleted_charges = ROW_COUNT;

  -- Apaga onboarding contábil
  DELETE FROM onboarding_contabil WHERE professional_id = p_user_id;
  GET DIAGNOSTICS v_deleted_onboard = ROW_COUNT;

  -- Apaga assinaturas, módulos, saldo de horas, referrals (cascade já remove, mas explicitando)
  DELETE FROM subscriptions  WHERE professional_id = p_user_id;
  DELETE FROM user_modules   WHERE professional_id = p_user_id;
  DELETE FROM hour_balance   WHERE professional_id = p_user_id;
  DELETE FROM referrals      WHERE indicador_id    = p_user_id;
  DELETE FROM auth_attempts  WHERE identifier = (
    SELECT email FROM auth.users WHERE id = p_user_id
  );

  -- Anonimiza o perfil antes do auth.users ser excluído pelo cliente
  UPDATE profiles SET
    full_name   = 'Conta Excluída',
    bio         = NULL,
    plan_id     = NULL,
    pre_paid_ok = false,
    updated_at  = now()
  WHERE id = p_user_id;

  -- Registra no audit log antes de apagar
  INSERT INTO audit_log (professional_id, action, details)
  VALUES (p_user_id, 'account_deletion_requested', jsonb_build_object(
    'deleted_patients',     v_deleted_patients,
    'deleted_reservations', v_deleted_reserv,
    'deleted_charges',      v_deleted_charges,
    'deleted_onboarding',   v_deleted_onboard,
    'requested_at',         now()
  ));

  RETURN jsonb_build_object(
    'success',              true,
    'deleted_patients',     v_deleted_patients,
    'deleted_reservations', v_deleted_reserv,
    'deleted_charges',      v_deleted_charges
  );
END;
$$;

-- ── Função: export_my_data ────────────────────────────────────────────────────
-- Retorna todos os dados pessoais do profissional em JSON (LGPD portabilidade).
-- Nunca retorna CPF em texto puro (apenas hash).

CREATE OR REPLACE FUNCTION export_my_data()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_profile  jsonb;
  v_patients jsonb;
  v_reserv   jsonb;
  v_charges  jsonb;
  v_modules  jsonb;
  v_referrals jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Perfil
  SELECT to_jsonb(p) - 'id' - 'plan_id' INTO v_profile
  FROM profiles p WHERE id = v_uid;

  -- Pacientes (sem CPF em texto — apenas hash)
  SELECT jsonb_agg(to_jsonb(p) - 'professional_id') INTO v_patients
  FROM patients p WHERE professional_id = v_uid;

  -- Reservas
  SELECT jsonb_agg(to_jsonb(r) - 'professional_id') INTO v_reserv
  FROM reservations r WHERE professional_id = v_uid;

  -- Cobrança por minutagem
  SELECT jsonb_agg(to_jsonb(c) - 'professional_id') INTO v_charges
  FROM usage_charges c WHERE professional_id = v_uid;

  -- Módulos contratados
  SELECT jsonb_agg(jsonb_build_object(
    'modulo',    m.nome,
    'categoria', m.categoria,
    'status',    um.status,
    'ativo_ate', um.ativo_ate
  )) INTO v_modules
  FROM user_modules um
  JOIN modules m ON m.id = um.module_id
  WHERE um.professional_id = v_uid;

  -- Referrals
  SELECT jsonb_agg(to_jsonb(r) - 'indicador_id') INTO v_referrals
  FROM referrals r WHERE indicador_id = v_uid;

  RETURN jsonb_build_object(
    'exported_at',  now(),
    'profile',      COALESCE(v_profile,   'null'::jsonb),
    'patients',     COALESCE(v_patients,  '[]'::jsonb),
    'reservations', COALESCE(v_reserv,    '[]'::jsonb),
    'usage_charges',COALESCE(v_charges,   '[]'::jsonb),
    'modules',      COALESCE(v_modules,   '[]'::jsonb),
    'referrals',    COALESCE(v_referrals, '[]'::jsonb)
  );
END;
$$;
